from typing import TypedDict

from pydantic import BaseModel


class GapResponse(BaseModel):
    undefined_attribute: str
    what_is_implied: str
    development_suggestion: str


class GapDetectionInput(TypedDict):
    query: str
    retrieval_context: str


class GapDetectionOutput(TypedDict):
    gap_flags: list[dict]


class GapDetectionState(TypedDict):
    query: str
    retrieval_context: str
    gap_flags: list[dict]
