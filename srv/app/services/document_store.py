from __future__ import annotations

import logging
from typing import Protocol, runtime_checkable

from pydantic import BaseModel

logger = logging.getLogger(__name__)


class DocumentRecord(BaseModel):
    id: str
    user_id: str
    filename: str
    mime_type: str
    size: int
    content: str
    status: str = "uploaded"
    uploaded_at: str
    chunks_stored: int = 0
    error_message: str | None = None


@runtime_checkable
class DocumentStore(Protocol):
    """Async CRUD interface for uploaded document metadata + content."""

    async def add(self, record: DocumentRecord) -> None: ...

    async def get(self, user_id: str, doc_id: str) -> DocumentRecord | None: ...

    async def list(self, user_id: str) -> list[DocumentRecord]: ...

    async def delete(self, user_id: str, doc_id: str) -> bool: ...

    async def update(self, user_id: str, doc_id: str, **fields: object) -> None: ...


class InMemoryDocumentStore:
    """Dict-based store keyed by ``(user_id, doc_id)``. Ephemeral — lost on restart."""

    def __init__(self) -> None:
        self._docs: dict[tuple[str, str], DocumentRecord] = {}

    async def add(self, record: DocumentRecord) -> None:
        self._docs[(record.user_id, record.id)] = record

    async def get(self, user_id: str, doc_id: str) -> DocumentRecord | None:
        return self._docs.get((user_id, doc_id))

    async def list(self, user_id: str) -> list[DocumentRecord]:
        return [
            doc for key, doc in self._docs.items() if key[0] == user_id
        ]

    async def delete(self, user_id: str, doc_id: str) -> bool:
        return self._docs.pop((user_id, doc_id), None) is not None

    async def update(self, user_id: str, doc_id: str, **fields: object) -> None:
        doc = self._docs.get((user_id, doc_id))
        if doc is None:
            return
        updated = doc.model_copy(update=fields)
        self._docs[(user_id, doc_id)] = updated


class SupabaseDocumentStore:
    """Reads/writes the ``documents`` table in Supabase Postgres (stub).

    Production wiring will use the Supabase Python SDK or asyncpg
    for direct Postgres access.
    """

    def __init__(self, supabase_url: str, supabase_service_key: str) -> None:
        self._supabase_url = supabase_url
        self._supabase_service_key = supabase_service_key

    async def add(self, record: DocumentRecord) -> None:
        raise NotImplementedError

    async def get(self, user_id: str, doc_id: str) -> DocumentRecord | None:
        raise NotImplementedError

    async def list(self, user_id: str) -> list[DocumentRecord]:
        raise NotImplementedError

    async def delete(self, user_id: str, doc_id: str) -> bool:
        raise NotImplementedError

    async def update(self, user_id: str, doc_id: str, **fields: object) -> None:
        raise NotImplementedError
