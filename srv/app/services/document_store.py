from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Protocol, runtime_checkable

from pydantic import BaseModel

if TYPE_CHECKING:
    from supabase import Client

logger = logging.getLogger(__name__)

STORAGE_BUCKET = "documents"


class DocumentRecord(BaseModel):
    id: str
    user_id: str
    filename: str
    mime_type: str
    size: int
    content: str = ""
    storage_path: str | None = None
    status: str = "uploaded"
    uploaded_at: str = ""
    chunks_stored: int = 0
    error_message: str | None = None


@runtime_checkable
class DocumentStore(Protocol):
    """Async CRUD interface for uploaded document metadata + content."""

    async def add(self, record: DocumentRecord, raw_bytes: bytes | None = None) -> None: ...

    async def get(self, user_id: str, doc_id: str) -> DocumentRecord | None: ...

    async def list(self, user_id: str) -> list[DocumentRecord]: ...

    async def delete(self, user_id: str, doc_id: str) -> bool: ...

    async def update(self, user_id: str, doc_id: str, **fields: object) -> None: ...


class InMemoryDocumentStore:
    """Dict-based store keyed by ``(user_id, doc_id)``. Ephemeral -- lost on restart."""

    def __init__(self) -> None:
        self._docs: dict[tuple[str, str], DocumentRecord] = {}

    async def add(self, record: DocumentRecord, raw_bytes: bytes | None = None) -> None:
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
    """Reads/writes the ``documents`` table in Supabase Postgres and stores
    raw uploaded files in Supabase Storage.

    The Supabase ``Client`` is injected via the DI container -- this class
    never creates its own client.
    """

    def __init__(self, client: "Client") -> None:
        self._client = client

    # ── Public CRUD ────────────────────────────────────────────────────────

    async def add(self, record: DocumentRecord, raw_bytes: bytes | None = None) -> None:
        storage_path = None
        if raw_bytes is not None:
            storage_path = f"{record.user_id}/{record.id}/{record.filename}"
            self._upload_to_storage(storage_path, raw_bytes, record.mime_type)

        self._client.table("documents").insert({
            "id": record.id,
            "user_id": record.user_id,
            "filename": record.filename,
            "mime_type": record.mime_type,
            "size": record.size,
            "storage_path": storage_path,
            "status": record.status,
        }).execute()

    async def get(self, user_id: str, doc_id: str) -> DocumentRecord | None:
        result = (
            self._client.table("documents")
            .select("*")
            .eq("id", doc_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        if not result.data:
            return None
        return self._row_to_record(result.data)

    async def get_with_content(self, user_id: str, doc_id: str) -> DocumentRecord | None:
        """Like ``get()`` but also downloads the raw file from Storage."""
        record = await self.get(user_id, doc_id)
        if record is None or not record.storage_path:
            return record
        content = self._download_from_storage(record.storage_path)
        return record.model_copy(update={"content": content})

    async def list(self, user_id: str) -> list[DocumentRecord]:
        result = (
            self._client.table("documents")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return [self._row_to_record(row) for row in (result.data or [])]

    async def delete(self, user_id: str, doc_id: str) -> bool:
        record = await self.get(user_id, doc_id)
        if record is None:
            return False

        if record.storage_path:
            try:
                self._client.storage.from_(STORAGE_BUCKET).remove([record.storage_path])
            except Exception:
                logger.warning(
                    "Failed to remove storage object %s", record.storage_path, exc_info=True,
                )

        self._client.table("documents").delete().eq("id", doc_id).eq("user_id", user_id).execute()
        return True

    async def update(self, user_id: str, doc_id: str, **fields: object) -> None:
        if not fields:
            return
        (
            self._client.table("documents")
            .update(dict(fields))
            .eq("id", doc_id)
            .eq("user_id", user_id)
            .execute()
        )

    # ── Storage helpers ────────────────────────────────────────────────────

    def _upload_to_storage(self, path: str, data: bytes, content_type: str) -> None:
        self._client.storage.from_(STORAGE_BUCKET).upload(
            path,
            data,
            file_options={"content-type": content_type},
        )

    def _download_from_storage(self, path: str) -> str:
        raw: bytes = self._client.storage.from_(STORAGE_BUCKET).download(path)
        if path.endswith(".docx"):
            import io

            import docx

            doc = docx.Document(io.BytesIO(raw))
            return "\n\n".join(p.text for p in doc.paragraphs if p.text.strip())
        return raw.decode("utf-8")

    # ── Row mapping ────────────────────────────────────────────────────────

    @staticmethod
    def _row_to_record(row: dict) -> DocumentRecord:
        return DocumentRecord(
            id=str(row["id"]),
            user_id=str(row["user_id"]),
            filename=row["filename"],
            mime_type=row["mime_type"],
            size=row.get("size", 0),
            storage_path=row.get("storage_path"),
            status=row.get("status", "uploaded"),
            uploaded_at=row.get("created_at", ""),
            chunks_stored=row.get("chunks_stored", 0),
            error_message=row.get("error_message"),
        )
