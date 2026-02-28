"""Tests for the ingestion pipeline and retrieval tool integration.

Uses in-memory Qdrant and DeterministicFakeEmbedding so no external
services are required.  Classification LLM calls are mocked.
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from langchain_core.documents import Document

from agents.tools.retrieval.config import RetrievalToolSettings
from agents.tools.retrieval.schemas import RetrievalResult
from agents.tools.retrieval.tool import RetrievalToolBuilder
from pipeline.chunking import apply_semantic_overlap, prepend_metadata_title
from pipeline.classification import ChunkClassification, classify_chunks_async
from pipeline.config import IngestionPipelineSettings
from pipeline.runner import LocalPipelineRunner, ModalPipelineRunner
from pipeline.service import IngestionPipelineService

# ── Chunking unit tests ───────────────────────────────────────────────────


def test_apply_semantic_overlap_empty():
    assert apply_semantic_overlap([]) == []


def test_apply_semantic_overlap_single_chunk():
    doc = Document(page_content="One sentence. Two sentence.")
    result = apply_semantic_overlap([doc], overlap_sentences=2)
    assert len(result) == 1
    assert result[0].page_content == doc.page_content
    assert result[0].metadata["overlap_sentence_count"] == 0


def test_apply_semantic_overlap_prepends_tail():
    a = Document(page_content="First. Second. Third. Fourth.")
    b = Document(page_content="Fifth. Sixth.")
    result = apply_semantic_overlap([a, b], overlap_sentences=2)

    assert len(result) == 2
    assert result[0].metadata["overlap_sentence_count"] == 0
    assert result[1].metadata["overlap_sentence_count"] == 2
    assert "Third." in result[1].page_content
    assert "Fourth." in result[1].page_content
    assert result[1].page_content.index("Third.") < result[1].page_content.index("Fifth.")


def test_prepend_metadata_title():
    doc = Document(
        page_content="Some story text.",
        metadata={
            "content_type": "dialogue",
            "narrative_function": "character_reveal",
            "characters_present": ["PurpleFrog", "OchraMags"],
            "story_grid_tag": "none",
        },
    )
    result = prepend_metadata_title([doc])
    assert len(result) == 1
    assert result[0].page_content.startswith("[dialogue | character_reveal")
    assert "characters: PurpleFrog, OchraMags" in result[0].page_content
    assert "Some story text." in result[0].page_content


def test_prepend_metadata_title_includes_story_grid_tag():
    doc = Document(
        page_content="Crisis moment.",
        metadata={
            "content_type": "action_reaction",
            "narrative_function": "plot_event",
            "characters_present": ["PurpleFrog"],
            "story_grid_tag": "crisis",
        },
    )
    result = prepend_metadata_title([doc])
    assert "crisis" in result[0].page_content


# ── Classification unit tests ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_classify_chunks_async_attaches_metadata():
    classification = ChunkClassification(
        content_type="dialogue",
        narrative_function="plot_event",
        characters_present=["PurpleFrog"],
        story_grid_tag="none",
        external_references=[],
        implied_gaps=[],
    )

    chunks = [Document(page_content="PurpleFrog said hello.")]

    with patch(
        "pipeline.classification._ainvoke_with_retry",
        new_callable=AsyncMock,
        return_value=classification,
    ):
        result = await classify_chunks_async(chunks, ["PurpleFrog"], MagicMock())

    assert len(result) == 1
    assert result[0].metadata["content_type"] == "dialogue"
    assert result[0].metadata["characters_present"] == ["PurpleFrog"]
    assert result[0].page_content == "PurpleFrog said hello."


# ── Pipeline settings tests ──────────────────────────────────────────────


def test_pipeline_settings_defaults():
    settings = IngestionPipelineSettings()
    assert settings.collection_name == "lrwr_chunks"
    assert settings.embedding_model == "text-embedding-3-small"
    assert settings.use_modal is False
    assert settings.chunk_size == 500
    assert settings.overlap_sentences == 3


# ── Pipeline service tests ────────────────────────────────────────────────


SAMPLE_DOCS = [
    Document(
        page_content=(
            "PurpleFrog stared at the flickering LED screen. "
            "The colony had been underground for 720 days. "
            "She missed the sky. She missed her brother."
        ),
        metadata={"source": "test-doc.md"},
    ),
]


@pytest.mark.asyncio
async def test_baseline_pipeline_ingest(qdrant_in_memory, fake_embeddings):
    settings = IngestionPipelineSettings(collection_name="test_baseline")
    pipeline = IngestionPipelineService(
        settings=settings,
        qdrant_client=qdrant_in_memory,
        embeddings=fake_embeddings,
    )

    count = await pipeline.ingest(SAMPLE_DOCS, [], pipeline_option="baseline")
    assert count > 0

    collections = qdrant_in_memory.get_collections().collections
    names = [c.name for c in collections]
    assert "test_baseline" in names


@pytest.mark.asyncio
async def test_advanced_pipeline_ingest(qdrant_in_memory, fake_embeddings):
    """Advanced pipeline with mocked classification LLM."""
    settings = IngestionPipelineSettings(collection_name="test_advanced")
    pipeline = IngestionPipelineService(
        settings=settings,
        qdrant_client=qdrant_in_memory,
        embeddings=fake_embeddings,
    )

    classification = ChunkClassification(
        content_type="internal_monologue",
        narrative_function="character_reveal",
        characters_present=["PurpleFrog"],
        story_grid_tag="none",
        external_references=[],
        implied_gaps=["What happened to her brother?"],
    )

    mock_structured = AsyncMock(return_value=classification)
    mock_chain = MagicMock()
    mock_chain.__or__ = MagicMock(return_value=mock_chain)
    mock_chain.ainvoke = mock_structured

    with patch("pipeline.service.ChatOpenAI") as mock_chat:
        mock_llm = MagicMock()
        mock_llm.with_structured_output.return_value = mock_chain
        mock_chat.return_value = mock_llm

        count = await pipeline.ingest(
            SAMPLE_DOCS,
            ["PurpleFrog", "SnowRaven"],
            pipeline_option="advanced",
        )

    assert count > 0

    collections = qdrant_in_memory.get_collections().collections
    names = [c.name for c in collections]
    assert "test_advanced" in names


@pytest.mark.asyncio
async def test_pipeline_rejects_unknown_option(qdrant_in_memory, fake_embeddings):
    settings = IngestionPipelineSettings()
    pipeline = IngestionPipelineService(
        settings=settings,
        qdrant_client=qdrant_in_memory,
        embeddings=fake_embeddings,
    )

    with pytest.raises(ValueError, match="Unknown pipeline_option"):
        await pipeline.ingest(SAMPLE_DOCS, [], pipeline_option="unknown")


# ── Retrieval tool tests ─────────────────────────────────────────────────


def test_retrieval_tool_empty_collection(qdrant_in_memory, fake_embeddings):
    """Returns low_confidence when no documents have been ingested."""
    settings = RetrievalToolSettings(
        collection_name="nonexistent",
        cohere_api_key="unused",
    )
    builder = RetrievalToolBuilder(
        settings=settings,
        qdrant_client=qdrant_in_memory,
        embeddings=fake_embeddings,
    )
    tool = builder.build()
    result_json = tool.invoke("any query")
    result = RetrievalResult.model_validate(json.loads(result_json))
    assert result.low_confidence is True
    assert result.ranked_chunks == []


@pytest.mark.asyncio
async def test_ingest_then_retrieve(qdrant_in_memory, fake_embeddings):
    """End-to-end: ingest via baseline pipeline, then retrieve via tool."""
    collection = "test_e2e"
    pipeline_settings = IngestionPipelineSettings(collection_name=collection)
    pipeline = IngestionPipelineService(
        settings=pipeline_settings,
        qdrant_client=qdrant_in_memory,
        embeddings=fake_embeddings,
    )
    await pipeline.ingest(SAMPLE_DOCS, [], pipeline_option="baseline")

    tool_settings = RetrievalToolSettings(
        collection_name=collection,
        cohere_api_key="unused",
    )
    builder = RetrievalToolBuilder(
        settings=tool_settings,
        qdrant_client=qdrant_in_memory,
        embeddings=fake_embeddings,
    )
    tool = builder.build()

    with patch("agents.tools.retrieval.tool.ContextualCompressionRetriever") as mock_ccr:
        mock_retriever = MagicMock()
        mock_retriever.invoke.return_value = [
            Document(
                page_content="PurpleFrog stared at the flickering LED screen.",
                metadata={"source": "test-doc.md", "relevance_score": 0.9},
            ),
        ]
        mock_ccr.return_value = mock_retriever

        result_json = tool.invoke("PurpleFrog underground")

    result = RetrievalResult.model_validate(json.loads(result_json))
    assert result.low_confidence is False
    assert len(result.ranked_chunks) > 0
    assert "PurpleFrog" in result.ranked_chunks[0].text


# ── Runner tests ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_local_runner_delegates(qdrant_in_memory, fake_embeddings):
    settings = IngestionPipelineSettings(collection_name="test_runner")
    pipeline = IngestionPipelineService(
        settings=settings,
        qdrant_client=qdrant_in_memory,
        embeddings=fake_embeddings,
    )
    runner = LocalPipelineRunner(pipeline=pipeline)

    count = await runner.run(SAMPLE_DOCS, [], "baseline")
    assert count > 0


def test_modal_runner_lazy_import():
    """ModalPipelineRunner can be instantiated without modal installed."""
    runner = ModalPipelineRunner()
    assert runner._function_name == "process_document"
