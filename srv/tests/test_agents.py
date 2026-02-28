import json
from unittest.mock import MagicMock, patch

import pytest
from langchain_core.documents import Document

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
from pipeline.config import IngestionPipelineSettings
from pipeline.service import IngestionPipelineService


def test_agent_builder_compile_is_sealed():
    with pytest.raises(TypeError, match="must not override compile"):

        class BadAgent(AgentBuilder):
            def compile(self):
                pass

            def _build(self):
                pass


def test_retrieval_tool_returns_valid_schema(qdrant_in_memory, fake_embeddings):
    settings = RetrievalToolSettings(cohere_api_key="unused")
    builder = RetrievalToolBuilder(
        settings=settings,
        qdrant_client=qdrant_in_memory,
        embeddings=fake_embeddings,
    )
    tool = builder.build()
    result_json = tool.invoke("test query")
    result = RetrievalResult.model_validate(json.loads(result_json))
    assert result.low_confidence is True
    assert result.ranked_chunks == []


TAVILY_DUMMY_RESPONSE = [
    {
        "title": "Story Grid - Writing Craft",
        "url": "https://storygrid.com/theory",
        "content": (
            "The Story Grid is a methodology for analysing and creating stories. "
            "It identifies the five commandments of storytelling: Inciting Incident, "
            "Progressive Complication, Crisis, Climax, and Resolution."
        ),
    },
    {
        "title": "Five Commandments of Storytelling",
        "url": "https://storygrid.com/five-commandments",
        "content": (
            "Every unit of story — beat, scene, sequence, act, subplot, global — "
            "must contain all five commandments to work."
        ),
    },
]


def test_tavily_tool_returns_results():
    with patch(
        "langchain_tavily.TavilySearch.invoke",
        return_value=json.dumps(TAVILY_DUMMY_RESPONSE),
    ):
        builder = TavilyToolBuilder(settings=TavilyToolSettings(api_key="test-key"))
        tool = builder.build()
        result_json = tool.invoke("Story Grid theory")
        results = json.loads(result_json)
        assert len(results) == 2
        assert results[0]["title"] == "Story Grid - Writing Craft"
        assert "url" in results[0]
        assert "content" in results[0]


@pytest.mark.asyncio
async def test_avatar_agent_produces_output():
    builder = AvatarAgentBuilder(settings=AvatarAgentSettings())
    graph = builder.compile()
    result = await graph.ainvoke(
        {
            "query": "What drives PurpleFrog?",
            "intent": "in_character",
            "retrieval_context": "dummy context",
            "tavily_context": None,
            "gap_flags": [],
        }
    )
    assert "response_text" in result
    assert len(result["response_text"]) > 0
    assert "citations" in result


@pytest.mark.asyncio
async def test_gap_detection_agent_produces_output():
    builder = GapDetectionAgentBuilder(settings=GapDetectionAgentSettings())
    graph = builder.compile()
    result = await graph.ainvoke(
        {
            "query": "What happened before Day 720?",
            "retrieval_context": "dummy context",
        }
    )
    assert "gap_flags" in result
    assert len(result["gap_flags"]) > 0
    assert "undefined_attribute" in result["gap_flags"][0]


@pytest.fixture
async def populated_qdrant(qdrant_in_memory, fake_embeddings):
    """Qdrant with test documents so the retrieval tool returns results."""
    settings = IngestionPipelineSettings(collection_name="lrwr_chunks")
    pipeline = IngestionPipelineService(
        settings=settings,
        qdrant_client=qdrant_in_memory,
        embeddings=fake_embeddings,
    )
    await pipeline.ingest(
        [
            Document(
                page_content=(
                    "PurpleFrog is driven by her deep need to protect the colony "
                    "and uncover the truth about the surface world. She struggles "
                    "with self-doubt but her curiosity always pushes her forward."
                ),
                metadata={"source": "purplefrog-story-notes.md"},
            ),
        ],
        [],
        pipeline_option="baseline",
    )
    return qdrant_in_memory


@pytest.mark.asyncio
async def test_supervisor_produces_full_output(populated_qdrant, fake_embeddings):
    def _bypass_rerank(**kwargs):
        mock = MagicMock()
        mock.invoke = kwargs["base_retriever"].invoke
        return mock

    with (
        patch("agents.tools.retrieval.tool.CohereRerank"),
        patch(
            "agents.tools.retrieval.tool.ContextualCompressionRetriever",
            side_effect=_bypass_rerank,
        ),
    ):
        builder = SupervisorAgentBuilder(
            settings=SupervisorAgentSettings(),
            retrieval_tool_builder=RetrievalToolBuilder(
                settings=RetrievalToolSettings(cohere_api_key="unused"),
                qdrant_client=populated_qdrant,
                embeddings=fake_embeddings,
            ),
            tavily_tool_builder=TavilyToolBuilder(settings=TavilyToolSettings()),
            avatar_agent_builder=AvatarAgentBuilder(settings=AvatarAgentSettings()),
            gap_detection_builder=GapDetectionAgentBuilder(settings=GapDetectionAgentSettings()),
        )
        graph = builder.compile()
        result = await graph.ainvoke(
            {
                "message": "What drives PurpleFrog?",
                "character_id": "purplefrog",
                "conversation_history": [],
                "narrative_state": {},
            }
        )
    assert "response_text" in result
    assert "intent" in result
    assert "citations" in result
    assert "gap_flags" in result
    assert "tavily_used" in result


@pytest.mark.asyncio
async def test_supervisor_no_context_early_exit(qdrant_in_memory, fake_embeddings):
    """When no documents are ingested the supervisor returns guidance instead of looping."""
    builder = SupervisorAgentBuilder(
        settings=SupervisorAgentSettings(),
        retrieval_tool_builder=RetrievalToolBuilder(
            settings=RetrievalToolSettings(cohere_api_key="unused"),
            qdrant_client=qdrant_in_memory,
            embeddings=fake_embeddings,
        ),
        tavily_tool_builder=TavilyToolBuilder(settings=TavilyToolSettings()),
        avatar_agent_builder=AvatarAgentBuilder(settings=AvatarAgentSettings()),
        gap_detection_builder=GapDetectionAgentBuilder(settings=GapDetectionAgentSettings()),
    )
    graph = builder.compile()
    result = await graph.ainvoke(
        {
            "message": "What drives PurpleFrog?",
            "character_id": "purplefrog",
            "conversation_history": [],
            "narrative_state": {},
        }
    )
    assert "upload" in result["response_text"].lower()
    assert "extract" in result["response_text"].lower()
    assert result["citations"] == []
    assert result["gap_flags"] == []
    assert result["tavily_used"] is False


def test_compile_is_cached():
    builder = AvatarAgentBuilder(settings=AvatarAgentSettings())
    graph1 = builder.compile()
    graph2 = builder.compile()
    assert graph1 is graph2
