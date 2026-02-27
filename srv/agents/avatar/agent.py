from langgraph.graph import END, StateGraph
from langgraph.graph.state import CompiledStateGraph

from agents.avatar.config import AvatarAgentSettings
from agents.avatar.schemas import AvatarInput, AvatarOutput, AvatarState
from agents.base import AgentBuilder


class AvatarAgentBuilder(AgentBuilder):
    """Generates in-character or analytical responses.

    Currently returns a canned dummy response for end-to-end testing.
    """

    def __init__(self, settings: AvatarAgentSettings) -> None:
        self.settings = settings

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
        response = (
            f"*considers the question carefully...*\n\n"
            f"Based on the story material, here is what I can tell you about: {query}\n\n"
            f"This character would act decisively, driven by their core motivations "
            f"as established in the source documents."
        )
        citations = [
            {
                "source": "purplefrog-story-notes.md",
                "chunk_index": 0,
            }
        ]
        return {"response_text": response, "citations": citations}
