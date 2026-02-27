from langgraph.graph import END, StateGraph
from langgraph.graph.state import CompiledStateGraph

from agents.base import AgentBuilder
from agents.gap_detection.config import GapDetectionAgentSettings
from agents.gap_detection.schemas import (
    GapDetectionInput,
    GapDetectionOutput,
    GapDetectionState,
    GapResponse,
)


class GapDetectionAgentBuilder(AgentBuilder):
    """Structures undefined character attributes as development signals.

    Currently returns a dummy gap flag for end-to-end testing.
    """

    def __init__(self, settings: GapDetectionAgentSettings) -> None:
        self.settings = settings

    def _build(self) -> CompiledStateGraph:
        graph = StateGraph(
            GapDetectionState,
            input_schema=GapDetectionInput,
            output_schema=GapDetectionOutput,
        )

        graph.add_node("detect_gaps", self._detect_gaps)
        graph.set_entry_point("detect_gaps")
        graph.add_edge("detect_gaps", END)

        return graph.compile()

    async def _detect_gaps(self, state: GapDetectionState) -> dict:
        dummy_gap = GapResponse(
            undefined_attribute="character backstory before Day 720",
            what_is_implied="The character has a past that shaped their current behavior",
            development_suggestion=(
                "Consider defining key events from before Day 720 "
                "that explain the character's protective instincts."
            ),
        )
        return {"gap_flags": [dummy_gap.model_dump()]}
