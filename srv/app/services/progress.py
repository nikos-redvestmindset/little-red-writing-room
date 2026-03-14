from __future__ import annotations

import asyncio
import json
import logging
import re
from collections.abc import AsyncIterator
from typing import TYPE_CHECKING, Protocol, runtime_checkable

from pydantic import BaseModel

if TYPE_CHECKING:
    import asyncpg
    from supabase import Client

logger = logging.getLogger(__name__)

_DSN_RE = re.compile(r"^postgresql://([^:]+):(.+)@([^@]+):(\d+)/(.+)$")

PROCESSING_JOBS_TABLE = "processing_jobs"


class ProgressEvent(BaseModel):
    stage: str
    progress_pct: int
    chunks_total: int | None = None
    chunks_processed: int | None = None
    message: str = ""


@runtime_checkable
class ProgressNotifier(Protocol):
    """Push/subscribe interface for extraction progress events."""

    async def notify(self, document_id: str, event: ProgressEvent) -> None:
        """Push a progress event for the given document."""
        ...

    def subscribe(self, document_id: str) -> AsyncIterator[ProgressEvent]:
        """Yield progress events as they arrive. Terminates on 'complete' or 'failed'."""
        ...


_TERMINAL_STAGES = frozenset(("complete", "failed"))


class InMemoryProgressNotifier:
    """Uses ``asyncio.Queue`` per document_id.

    Events flow from the pipeline background task to the SSE generator
    within the same process and event loop.
    """

    def __init__(self) -> None:
        self._queues: dict[str, asyncio.Queue[ProgressEvent]] = {}

    async def notify(self, document_id: str, event: ProgressEvent) -> None:
        queue = self._queues.get(document_id)
        if queue is not None:
            await queue.put(event)

    async def subscribe(self, document_id: str) -> AsyncIterator[ProgressEvent]:
        queue: asyncio.Queue[ProgressEvent] = asyncio.Queue()
        self._queues[document_id] = queue
        try:
            while True:
                event = await queue.get()
                yield event
                if event.stage in _TERMINAL_STAGES:
                    break
        finally:
            self._queues.pop(document_id, None)


class SupabaseProgressNotifier:
    """Production implementation backed by Postgres.

    - ``notify()`` writes to the ``processing_jobs`` table. A BEFORE
      INSERT/UPDATE trigger on the table automatically calls
      ``pg_notify('doc_progress_{document_id}', payload_json)``.
    - ``subscribe()`` opens a dedicated asyncpg connection and
      ``LISTEN``s on the same channel, yielding ``ProgressEvent``
      objects as they arrive.

    When Modal runs the pipeline on a separate machine, the Modal
    function calls ``notify()`` which writes to Postgres; the trigger
    fires ``pg_notify``.  The FastAPI server's ``subscribe()`` picks
    up the NOTIFY and streams it to the browser via SSE — identical
    code path as InMemory, just a different event transport.
    """

    def __init__(self, client: "Client", database_url: str = "") -> None:
        self._client = client
        self._database_url = database_url

    async def notify(self, document_id: str, event: ProgressEvent) -> None:
        self._client.table(PROCESSING_JOBS_TABLE).update(
            {
                "current_stage": event.stage,
                "progress_pct": event.progress_pct,
                "chunks_total": event.chunks_total,
                "chunks_processed": event.chunks_processed,
                "message": event.message,
            }
        ).eq("document_id", document_id).execute()

    async def subscribe(self, document_id: str) -> AsyncIterator[ProgressEvent]:
        import asyncpg as _asyncpg

        if not self._database_url:
            raise RuntimeError(
                "SupabaseProgressNotifier.subscribe() requires a database_url "
                "(set DATABASE_URL in .env)"
            )

        channel = f"doc_progress_{document_id}"

        # Parse the DSN manually because Supabase passwords often contain
        # special characters (%, //) that break asyncpg's URL parser.
        m = _DSN_RE.match(self._database_url.strip().strip('"'))
        if m:
            conn: asyncpg.Connection = await _asyncpg.connect(
                user=m.group(1), password=m.group(2),
                host=m.group(3), port=int(m.group(4)), database=m.group(5),
            )
        else:
            conn = await _asyncpg.connect(self._database_url)

        queue: asyncio.Queue[str] = asyncio.Queue()

        def _on_notification(
            _conn: asyncpg.Connection,
            _pid: int,
            _channel: str,
            payload: str,
        ) -> None:
            queue.put_nowait(payload)

        await conn.add_listener(channel, _on_notification)
        try:
            while True:
                payload = await asyncio.wait_for(queue.get(), timeout=60)
                event = ProgressEvent.model_validate(json.loads(payload))
                yield event
                if event.stage in _TERMINAL_STAGES:
                    break
        finally:
            await conn.remove_listener(channel, _on_notification)
            await conn.close()
