import json
import logging

from langgraph.graph import END, StateGraph
from langgraph.graph.state import CompiledStateGraph

from agents.base import AgentBuilder
from agents.supervisor.config import SupervisorAgentSettings
from agents.supervisor.schemas import SupervisorInput, SupervisorOutput, SupervisorState

logger = logging.getLogger(__name__)


class SupervisorAgentBuilder(AgentBuilder):
    """Orchestrates a single chat turn.

    Node naming convention:
      _node   -- pure graph node (LLM call or logic, no external tool invocation)
      _tool   -- invokes a LangChain tool and returns its result to state
      _agent  -- delegates to a compiled sub-agent graph

    Flow:
      classify_intent_node
        -> call_retrieval_tool
        -> [conditional] call_tavily_tool
        -> [conditional] call_gap_detection_agent
        -> call_avatar_agent
        -> END -> SupervisorOutput bundle
    """

    def __init__(
        self,
        settings: SupervisorAgentSettings,
        retrieval_tool_builder,
        tavily_tool_builder,
        avatar_agent_builder,
        gap_detection_builder,
    ) -> None:
        self.settings = settings
        self.retrieval_tool = retrieval_tool_builder.build()
        self.tavily_tool = tavily_tool_builder.build()
        self.avatar_agent = avatar_agent_builder.compile()
        self.gap_detection_agent = gap_detection_builder.compile()

    def _build(self) -> CompiledStateGraph:
        graph = StateGraph(
            SupervisorState,
            input_schema=SupervisorInput,
            output_schema=SupervisorOutput,
        )

        graph.add_node("classify_intent_node", self._classify_intent_node)
        graph.add_node("call_retrieval_tool", self._call_retrieval_tool)
        graph.add_node("call_tavily_tool", self._call_tavily_tool)
        graph.add_node("call_gap_detection_agent", self._call_gap_detection_agent)
        graph.add_node("call_avatar_agent", self._call_avatar_agent)

        graph.set_entry_point("classify_intent_node")
        graph.add_edge("classify_intent_node", "call_retrieval_tool")

        graph.add_conditional_edges(
            "call_retrieval_tool",
            self._needs_tavily,
            {"yes": "call_tavily_tool", "no": "call_gap_detection_agent"},
        )
        graph.add_edge("call_tavily_tool", "call_gap_detection_agent")

        graph.add_conditional_edges(
            "call_gap_detection_agent",
            self._needs_gap_detection,
            {"yes": "call_gap_detection_agent", "no": "call_avatar_agent"},
        )
        graph.add_edge("call_gap_detection_agent", "call_avatar_agent")
        graph.add_edge("call_avatar_agent", END)

        return graph.compile()

    # ── Node implementations ──────────────────────────────────────────────

    async def _classify_intent_node(self, state: SupervisorState) -> dict:
        return {
            "intent": "in_character",
            "resolved_characters": [state.get("character_id", "unknown")],
        }

    async def _call_retrieval_tool(self, state: SupervisorState) -> dict:
        result = self.retrieval_tool.invoke(state["message"])
        return {"retrieval_result": result}

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
                "intent": state.get("intent", "in_character"),
                "retrieval_context": state.get("retrieval_result", ""),
                "tavily_context": state.get("tavily_result"),
                "gap_flags": state.get("gap_flags", []),
            }
        )
        return {
            "response_text": result["response_text"],
            "citations": result.get("citations", []),
            "narrative_state_delta": {},
            "tavily_used": state.get("tavily_used", False),
        }

    # ── Routing predicates ────────────────────────────────────────────────

    def _needs_tavily(self, state: SupervisorState) -> str:
        retrieval_raw = state.get("retrieval_result", "")
        if not retrieval_raw:
            return "no"
        try:
            parsed = json.loads(retrieval_raw)
            has_refs = bool(parsed.get("external_references"))
            return "yes" if has_refs else "no"
        except (json.JSONDecodeError, AttributeError):
            return "no"

    def _needs_gap_detection(self, state: SupervisorState) -> str:
        retrieval_raw = state.get("retrieval_result", "")
        if not retrieval_raw:
            return "no"
        try:
            parsed = json.loads(retrieval_raw)
            return "yes" if parsed.get("low_confidence", False) else "no"
        except (json.JSONDecodeError, AttributeError):
            return "no"
