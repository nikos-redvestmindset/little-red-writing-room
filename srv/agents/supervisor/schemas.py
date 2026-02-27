from typing import Any, TypedDict


class SupervisorInput(TypedDict):
    message: str
    character_id: str
    conversation_history: list[dict[str, str]]
    narrative_state: dict[str, Any]


class SupervisorOutput(TypedDict):
    response_text: str
    intent: str
    resolved_characters: list[str]
    citations: list[dict[str, Any]]
    gap_flags: list[dict[str, str]]
    narrative_state_delta: dict[str, Any]
    tavily_used: bool


class SupervisorState(TypedDict):
    message: str
    character_id: str
    conversation_history: list[dict[str, str]]
    narrative_state: dict[str, Any]
    # populated by nodes
    intent: str
    resolved_characters: list[str]
    retrieval_result: str | None
    tavily_result: str | None
    gap_flags: list[dict[str, str]]
    response_text: str
    citations: list[dict[str, Any]]
    narrative_state_delta: dict[str, Any]
    tavily_used: bool
