import pytest

from agents.avatar.agent import AvatarAgentBuilder
from agents.avatar.config import AvatarAgentSettings
from agents.base import AgentBuilder
from agents.gap_detection.agent import GapDetectionAgentBuilder
from agents.gap_detection.config import GapDetectionAgentSettings
from agents.supervisor.agent import SupervisorAgentBuilder
from agents.supervisor.config import SupervisorAgentSettings
from agents.tools.retrieval.config import RetrievalToolSettings
from agents.tools.retrieval.schemas import RetrievalResult
from agents.tools.retrieval.tool import RetrievalToolBuilder
from agents.tools.tavily.config import TavilyToolSettings
from agents.tools.tavily.tool import TavilyToolBuilder


def test_agent_builder_compile_is_sealed():
    with pytest.raises(TypeError, match="must not override compile"):
        class BadAgent(AgentBuilder):
            def compile(self):
                pass

            def _build(self):
                pass


def test_retrieval_tool_returns_valid_schema():
    import json

    builder = RetrievalToolBuilder(settings=RetrievalToolSettings())
    tool = builder.build()
    result_json = tool.invoke("test query")
    result = RetrievalResult.model_validate(json.loads(result_json))
    assert len(result.ranked_chunks) > 0
    assert result.ranked_chunks[0].source_document == "purplefrog-story-notes.md"


def test_tavily_tool_returns_results():
    import json

    builder = TavilyToolBuilder(settings=TavilyToolSettings())
    tool = builder.build()
    result_json = tool.invoke("Story Grid theory")
    results = json.loads(result_json)
    assert len(results) > 0
    assert "title" in results[0]


@pytest.mark.asyncio
async def test_avatar_agent_produces_output():
    builder = AvatarAgentBuilder(settings=AvatarAgentSettings())
    graph = builder.compile()
    result = await graph.ainvoke({
        "query": "What drives PurpleFrog?",
        "intent": "in_character",
        "retrieval_context": "dummy context",
        "tavily_context": None,
        "gap_flags": [],
    })
    assert "response_text" in result
    assert len(result["response_text"]) > 0
    assert "citations" in result


@pytest.mark.asyncio
async def test_gap_detection_agent_produces_output():
    builder = GapDetectionAgentBuilder(settings=GapDetectionAgentSettings())
    graph = builder.compile()
    result = await graph.ainvoke({
        "query": "What happened before Day 720?",
        "retrieval_context": "dummy context",
    })
    assert "gap_flags" in result
    assert len(result["gap_flags"]) > 0
    assert "undefined_attribute" in result["gap_flags"][0]


@pytest.mark.asyncio
async def test_supervisor_produces_full_output():
    builder = SupervisorAgentBuilder(
        settings=SupervisorAgentSettings(),
        retrieval_tool_builder=RetrievalToolBuilder(settings=RetrievalToolSettings()),
        tavily_tool_builder=TavilyToolBuilder(settings=TavilyToolSettings()),
        avatar_agent_builder=AvatarAgentBuilder(settings=AvatarAgentSettings()),
        gap_detection_builder=GapDetectionAgentBuilder(settings=GapDetectionAgentSettings()),
    )
    graph = builder.compile()
    result = await graph.ainvoke({
        "message": "What drives PurpleFrog?",
        "character_id": "purplefrog",
        "conversation_history": [],
        "narrative_state": {},
    })
    assert "response_text" in result
    assert "intent" in result
    assert "citations" in result
    assert "gap_flags" in result
    assert "tavily_used" in result


def test_compile_is_cached():
    builder = AvatarAgentBuilder(settings=AvatarAgentSettings())
    graph1 = builder.compile()
    graph2 = builder.compile()
    assert graph1 is graph2
