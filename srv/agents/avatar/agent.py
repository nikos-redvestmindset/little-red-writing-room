from __future__ import annotations

import json
import logging

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph
from langgraph.graph.state import CompiledStateGraph

from agents.avatar.config import AvatarAgentSettings
from agents.avatar.prompts import AVATAR_HUMAN_PROMPT, AVATAR_SYSTEM_PROMPT
from agents.avatar.schemas import AvatarInput, AvatarOutput, AvatarState
from agents.base import AgentBuilder

logger = logging.getLogger(__name__)


class AvatarAgentBuilder(AgentBuilder):
    """Generates in-character or analytical responses grounded in retrieved story context."""

    def __init__(self, settings: AvatarAgentSettings, openai_api_key: str = "") -> None:
        self.settings = settings
        self._openai_api_key = openai_api_key

    def _build(self) -> CompiledStateGraph:
        graph = StateGraph(
            AvatarState,
            input_schema=AvatarInput,
            output_schema=AvatarOutput,
        )

        graph.add_node("generate_response", self._generate_response)
        graph.set_entry_point("generate_response")
        graph.add_edge("generate_response", END)

        return graph.compile()

    async def _generate_response(self, state: AvatarState) -> dict:
        query = state.get("query", "")
        character_id = state.get("character_id", "")
        intent = state.get("intent", "in_character")
        raw_retrieval = state.get("retrieval_context", "")
        tavily_context = state.get("tavily_context")
        gap_flags = state.get("gap_flags", [])

        chunks, citations = _parse_retrieval(raw_retrieval)

        context_text = _format_chunks(chunks) if chunks else "No retrieved context available."
        tavily_section = f"Web search results:\n{tavily_context}" if tavily_context else ""
        gap_section = _format_gaps(gap_flags)

        system_content = (
            f"You are playing the character '{character_id}' from a fiction writer's story.\n\n"
            + AVATAR_SYSTEM_PROMPT
        )
        human_content = AVATAR_HUMAN_PROMPT.format(
            intent=intent,
            retrieval_context=context_text,
            tavily_section=tavily_section,
            gap_section=gap_section,
            query=query,
        )

        llm = ChatOpenAI(
            model=self.settings.model,
            temperature=0,
            api_key=self._openai_api_key or None,
        )
        response = await llm.ainvoke(
            [SystemMessage(content=system_content), HumanMessage(content=human_content)]
        )

        return {"response_text": response.content, "citations": citations}


# ── Helpers ───────────────────────────────────────────────────────────────────


def _parse_retrieval(raw: str) -> tuple[list[dict], list[dict]]:
    """Return (chunks, citations) from the retrieval tool JSON string."""
    if not raw:
        return [], []
    try:
        parsed = json.loads(raw)
    except (json.JSONDecodeError, AttributeError):
        return [], []
    chunks = parsed.get("ranked_chunks", [])
    citations = [
        {
            "source": c["source_document"],
            "chunk_index": c["chunk_index"],
            "text": c["text"],
        }
        for c in chunks
    ]
    return chunks, citations


def _format_chunks(chunks: list[dict]) -> str:
    return "\n\n".join(
        f"[{i + 1}] (source: {c['source_document']}, chunk: {c['chunk_index']})\n{c['text']}"
        for i, c in enumerate(chunks)
    )


def _format_gaps(gap_flags: list[dict]) -> str:
    if not gap_flags:
        return ""
    lines = "\n".join(
        f"- {g.get('undefined_attribute', '')}: {g.get('development_suggestion', '')}"
        for g in gap_flags
    )
    return f"Knowledge gaps (acknowledge these rather than inventing details):\n{lines}"
