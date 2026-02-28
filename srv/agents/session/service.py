import json
import logging
from collections.abc import AsyncGenerator

from fastapi import HTTPException
from supabase import Client, create_client

from agents.supervisor.agent import SupervisorAgentBuilder

logger = logging.getLogger(__name__)

HISTORY_WINDOW = 20


class AvatarSessionService:
    """Stateless wrapper around the supervisor graph.

    Reads/writes Supabase; invokes the graph; yields SSE frames.
    """

    def __init__(
        self,
        supervisor_builder: SupervisorAgentBuilder,
        supabase_url: str,
        supabase_service_key: str,
    ) -> None:
        self._supervisor_graph = supervisor_builder.compile()
        self._supabase: Client = create_client(supabase_url, supabase_service_key)

    def get_supabase_client(self) -> Client:
        return self._supabase

    async def assert_chat_owner(self, chat_id: str, user_id: str) -> None:
        result = (
            self._supabase.table("chats")
            .select("id")
            .eq("id", chat_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=403, detail="Chat not found or access denied")

    async def stream(
        self,
        chat_id: str,
        user_id: str,
        character_id: str,
        message: str,
    ) -> AsyncGenerator[str, None]:
        history = self._read_history(chat_id)
        narrative_state = self._read_narrative_state(chat_id)

        config = {"configurable": {"thread_id": chat_id}}
        result = await self._supervisor_graph.ainvoke(
            {
                "message": message,
                "character_id": character_id,
                "conversation_history": history,
                "narrative_state": narrative_state,
            },
            config=config,
        )

        response_text = result.get("response_text", "")
        citations = result.get("citations", [])
        gap_flags = result.get("gap_flags", [])

        for token in _chunk_text(response_text, chunk_size=20):
            yield _sse_frame("token", {"text": token})

        for citation in citations:
            yield _sse_frame("citation", citation)

        for gap in gap_flags:
            yield _sse_frame("gap", {
                "attribute": gap.get("undefined_attribute", gap.get("attribute", "")),
                "suggestion": gap.get("development_suggestion", gap.get("suggestion", "")),
            })

        self._persist_messages(chat_id, user_id, message, response_text, citations, gap_flags)
        self._persist_narrative_state(
            chat_id, user_id, result.get("narrative_state_delta", {})
        )

        yield _sse_frame("done", {"chat_id": chat_id})

    # ── Supabase reads ────────────────────────────────────────────────────

    def _read_history(self, chat_id: str) -> list[dict[str, str]]:
        result = (
            self._supabase.table("messages")
            .select("role, content")
            .eq("chat_id", chat_id)
            .order("created_at", desc=False)
            .limit(HISTORY_WINDOW)
            .execute()
        )
        return result.data or []

    def _read_narrative_state(self, chat_id: str) -> dict:
        result = (
            self._supabase.table("narrative_state")
            .select("state")
            .eq("chat_id", chat_id)
            .maybe_single()
            .execute()
        )
        if result and result.data:
            return result.data.get("state", {})
        return {}

    # ── Supabase writes ───────────────────────────────────────────────────

    def _persist_messages(
        self,
        chat_id: str,
        user_id: str,
        user_message: str,
        assistant_response: str,
        citations: list[dict],
        gap_flags: list[dict],
    ) -> None:
        self._supabase.table("messages").insert(
            [
                {
                    "chat_id": chat_id,
                    "user_id": user_id,
                    "role": "user",
                    "content": user_message,
                },
                {
                    "chat_id": chat_id,
                    "user_id": user_id,
                    "role": "assistant",
                    "content": assistant_response,
                    "citations": citations or None,
                    "gap_flags": gap_flags or None,
                },
            ]
        ).execute()

    def _persist_narrative_state(
        self, chat_id: str, user_id: str, delta: dict
    ) -> None:
        current = self._read_narrative_state(chat_id)
        merged = {**current, **delta}
        self._supabase.table("narrative_state").upsert(
            {
                "chat_id": chat_id,
                "user_id": user_id,
                "state": merged,
                "updated_at": "now()",
            }
        ).execute()


def _sse_frame(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _chunk_text(text: str, chunk_size: int = 20) -> list[str]:
    """Split text into small chunks to simulate token-by-token streaming.

    Splits on spaces only (preserving embedded newlines for paragraph structure)
    and appends a trailing space to every non-final chunk so that the frontend
    can concatenate chunks without losing word boundaries.
    """
    words = text.split(" ")
    chunks = []
    for i in range(0, len(words), chunk_size):
        chunk = " ".join(words[i : i + chunk_size])
        if i + chunk_size < len(words):
            chunk += " "
        chunks.append(chunk)
    return chunks
