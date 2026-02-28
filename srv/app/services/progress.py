from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator
from typing import Protocol, runtime_checkable

from pydantic import BaseModel

logger = logging.getLogger(__name__)


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
    """Production implementation (stub).

    - ``notify()`` writes to ``processing_jobs`` table AND calls
      ``pg_notify()`` on a channel keyed by document_id.
    - ``subscribe()`` uses asyncpg ``LISTEN`` on the same channel,
      yielding ``ProgressEvent`` objects as they arrive.

    When Modal runs the pipeline on a separate machine, the Modal
    function calls ``notify()`` which writes to Postgres + pg_notify.
    The FastAPI server's ``subscribe()`` picks up the NOTIFY and
    streams it to the browser via SSE — identical code path as
    InMemory, just a different event transport underneath.
    """

    def __init__(self, supabase_url: str, supabase_service_key: str) -> None:
        self._supabase_url = supabase_url
        self._supabase_service_key = supabase_service_key

    async def notify(self, document_id: str, event: ProgressEvent) -> None:
        raise NotImplementedError("SupabaseProgressNotifier.notify() not yet implemented")

    async def subscribe(self, document_id: str) -> AsyncIterator[ProgressEvent]:
        raise NotImplementedError("SupabaseProgressNotifier.subscribe() not yet implemented")
        # Make this function a valid async generator for type-checking purposes
        yield  # type: ignore[misc]  # pragma: no cover
