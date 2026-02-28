from typing import Any, TypedDict


class AvatarInput(TypedDict):
    query: str
    character_id: str
    intent: str
    retrieval_context: str
    tavily_context: str | None
    gap_flags: list[dict[str, str]]


class AvatarOutput(TypedDict):
    response_text: str
    citations: list[dict[str, Any]]


class AvatarState(TypedDict):
    query: str
    character_id: str
    intent: str
    retrieval_context: str
    tavily_context: str | None
    gap_flags: list[dict[str, str]]
    response_text: str
    citations: list[dict[str, Any]]
