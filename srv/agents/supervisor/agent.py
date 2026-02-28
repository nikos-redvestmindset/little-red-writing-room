import json
import logging

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph
from langgraph.graph.state import CompiledStateGraph

from agents.base import AgentBuilder
from agents.supervisor.config import SupervisorAgentSettings
from agents.supervisor.schemas import SupervisorInput, SupervisorOutput, SupervisorState

logger = logging.getLogger(__name__)


_NO_CONTEXT_RESPONSE = (
    "I don't have any reference material to work with yet. "
    "Please upload your documents and select **Extract** to build "
    "the knowledge base, then ask me again!"
)


class SupervisorAgentBuilder(AgentBuilder):
    """Orchestrates a single chat turn.

    Node naming convention:
      _node   -- pure graph node (LLM call or logic, no external tool invocation)
      _tool   -- invokes a LangChain tool and returns its result to state
      _agent  -- delegates to a compiled sub-agent graph

    Flow::

      classify_intent_node
        -> call_retrieval_tool
        -> [route_after_retrieval]
            no_context  -> handle_no_context -> END
            tavily      -> call_tavily_tool  -> [route_after_tavily]
                              gap_detection -> call_gap_detection_agent -> call_avatar_agent -> END
                              avatar        -> call_avatar_agent -> END
            gap_detection -> call_gap_detection_agent -> call_avatar_agent -> END
            avatar        -> call_avatar_agent -> END
    """

    def __init__(
        self,
        settings: SupervisorAgentSettings,
        retrieval_tool_builder,
        tavily_tool_builder,
        avatar_agent_builder,
        gap_detection_builder,
        checkpointer: MemorySaver | None = None,
    ) -> None:
        self.settings = settings
        self.retrieval_tool = retrieval_tool_builder.build()
        self.tavily_tool = tavily_tool_builder.build()
        self.avatar_agent = avatar_agent_builder.compile()
        self.gap_detection_agent = gap_detection_builder.compile()
        self._checkpointer = checkpointer

    def _build(self) -> CompiledStateGraph:
        graph = StateGraph(
            SupervisorState,
            input_schema=SupervisorInput,
            output_schema=SupervisorOutput,
        )

        graph.add_node("classify_intent_node", self._classify_intent_node)
        graph.add_node("call_retrieval_tool", self._call_retrieval_tool)
        graph.add_node("handle_no_context", self._handle_no_context)
        graph.add_node("call_tavily_tool", self._call_tavily_tool)
        graph.add_node("call_gap_detection_agent", self._call_gap_detection_agent)
        graph.add_node("call_avatar_agent", self._call_avatar_agent)

        graph.set_entry_point("classify_intent_node")
        graph.add_edge("classify_intent_node", "call_retrieval_tool")

        graph.add_conditional_edges(
            "call_retrieval_tool",
            self._route_after_retrieval,
            {
                "no_context": "handle_no_context",
                "tavily": "call_tavily_tool",
                "gap_detection": "call_gap_detection_agent",
                "avatar": "call_avatar_agent",
            },
        )

        graph.add_edge("handle_no_context", END)

        graph.add_conditional_edges(
            "call_tavily_tool",
            self._route_after_tavily,
            {
                "gap_detection": "call_gap_detection_agent",
                "avatar": "call_avatar_agent",
            },
        )

        graph.add_edge("call_gap_detection_agent", "call_avatar_agent")
        graph.add_edge("call_avatar_agent", END)

        return graph.compile(checkpointer=self._checkpointer)

    # ── Node implementations ──────────────────────────────────────────────

    async def _classify_intent_node(self, state: SupervisorState) -> dict:
        return {
            "intent": "in_character",
            "resolved_characters": [state.get("character_id", "unknown")],
            "gap_flags": [],
            "tavily_used": False,
        }

    async def _call_retrieval_tool(self, state: SupervisorState) -> dict:
        result = self.retrieval_tool.invoke(state["message"])
        return {"retrieval_result": result}

    async def _handle_no_context(self, state: SupervisorState) -> dict:
        logger.info("No knowledge base context available — returning guidance")
        return {
            "response_text": _NO_CONTEXT_RESPONSE,
            "citations": [],
            "gap_flags": [],
            "narrative_state_delta": {},
            "tavily_used": False,
        }

    async def _call_tavily_tool(self, state: SupervisorState) -> dict:
        result = self.tavily_tool.invoke(state["message"])
        return {"tavily_result": result, "tavily_used": True}

    async def _call_gap_detection_agent(self, state: SupervisorState) -> dict:
        result = await self.gap_detection_agent.ainvoke(
            {
                "query": state["message"],
                "retrieval_context": state.get("retrieval_result", ""),
            }
        )
        return {"gap_flags": result.get("gap_flags", [])}

    async def _call_avatar_agent(self, state: SupervisorState) -> dict:
        result = await self.avatar_agent.ainvoke(
            {
                "query": state["message"],
                "character_id": state.get("character_id", ""),
                "intent": state.get("intent", "in_character"),
                "retrieval_context": state.get("retrieval_result", ""),
                "tavily_context": state.get("tavily_result"),
                "gap_flags": state.get("gap_flags", []),
                "conversation_history": state.get("conversation_history", []),
            }
        )
        return {
            "response_text": result["response_text"],
            "citations": result.get("citations", []),
            "narrative_state_delta": {},
            "tavily_used": state.get("tavily_used", False),
        }

    # ── Routing predicates ────────────────────────────────────────────────

    def _parse_retrieval(self, state: SupervisorState) -> dict | None:
        raw = state.get("retrieval_result", "")
        if not raw:
            return None
        try:
            return json.loads(raw)
        except (json.JSONDecodeError, AttributeError):
            return None

    def _route_after_retrieval(self, state: SupervisorState) -> str:
        parsed = self._parse_retrieval(state)

        if parsed is None:
            return "no_context"

        low_confidence = parsed.get("low_confidence", False)
        has_chunks = bool(parsed.get("ranked_chunks"))

        if low_confidence and not has_chunks:
            return "no_context"

        if parsed.get("external_references"):
            return "tavily"

        if low_confidence:
            return "gap_detection"

        return "avatar"

    def _route_after_tavily(self, state: SupervisorState) -> str:
        parsed = self._parse_retrieval(state)
        if parsed and parsed.get("low_confidence", False):
            return "gap_detection"
        return "avatar"
