"""Tests for document deletion with Qdrant chunk cleanup.

Uses InMemoryDocumentStore + in-memory Qdrant + DeterministicFakeEmbedding
so no external services are required.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from langchain_core.documents import Document

from app.services.document_store import DocumentRecord, InMemoryDocumentStore
from tests.conftest import TEST_USER_ID
from pipeline.config import IngestionPipelineSettings
from pipeline.service import IngestionPipelineService

COLLECTION = "test_doc_delete"

SAMPLE_DOC = Document(
    page_content=(
        "PurpleFrog stared at the flickering LED screen. "
        "The colony had been underground for 720 days."
    ),
    metadata={"source": "chapter1.md"},
)


def _count_points(qdrant, collection_name: str) -> int:
    try:
        info = qdrant.get_collection(collection_name)
        return info.points_count
    except Exception:
        return 0


def _make_record(doc_id: str, user_id: str = TEST_USER_ID) -> DocumentRecord:
    return DocumentRecord(
        id=doc_id,
        user_id=user_id,
        filename="chapter1.md",
        mime_type="text/markdown",
        size=100,
        content="some content",
        status="extracted",
        chunks_stored=1,
    )


@pytest.fixture
def doc_test_env(test_app, qdrant_in_memory, fake_embeddings):
    """Overrides DI with in-memory document store, Qdrant, and embeddings."""
    from dependency_injector import providers

    app, _ = test_app
    container = app.state.container

    store = InMemoryDocumentStore()
    settings = IngestionPipelineSettings(collection_name=COLLECTION)
    pipeline = IngestionPipelineService(
        settings=settings,
        qdrant_client=qdrant_in_memory,
        embeddings=fake_embeddings,
    )

    container.document_store.override(providers.Object(store))
    container.ingestion_pipeline.override(providers.Object(pipeline))

    client = TestClient(app)

    yield client, store, pipeline, qdrant_in_memory

    container.document_store.reset_override()
    container.ingestion_pipeline.reset_override()


@pytest.mark.asyncio
async def test_delete_document_removes_qdrant_chunks(doc_test_env, auth_headers):
    client, store, pipeline, qdrant = doc_test_env
    doc_id = "doc-delete-1"

    await store.add(_make_record(doc_id))
    await pipeline.ingest(
        [SAMPLE_DOC], {}, pipeline_option="baseline",
        document_id=doc_id, user_id=TEST_USER_ID,
    )
    assert _count_points(qdrant, COLLECTION) > 0

    resp = client.delete(f"/documents/{doc_id}", headers=auth_headers)
    assert resp.status_code == 204
    assert _count_points(qdrant, COLLECTION) == 0


@pytest.mark.asyncio
async def test_delete_preserves_other_documents_chunks(doc_test_env, auth_headers):
    client, store, pipeline, qdrant = doc_test_env

    await store.add(_make_record("doc-A"))
    count_a = await pipeline.ingest(
        [SAMPLE_DOC], {}, pipeline_option="baseline",
        document_id="doc-A", user_id=TEST_USER_ID,
    )

    await store.add(_make_record("doc-B"))
    count_b = await pipeline.ingest(
        [Document(page_content="Totally different content about dragons.", metadata={"source": "b.md"})],
        {}, pipeline_option="baseline",
        document_id="doc-B", user_id=TEST_USER_ID,
    )
    assert _count_points(qdrant, COLLECTION) == count_a + count_b

    resp = client.delete("/documents/doc-A", headers=auth_headers)
    assert resp.status_code == 204
    assert _count_points(qdrant, COLLECTION) == count_b


def test_delete_nonexistent_document_returns_404(doc_test_env, auth_headers):
    client, *_ = doc_test_env
    resp = client.delete("/documents/nonexistent-id", headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_document_removes_store_record(doc_test_env, auth_headers):
    client, store, pipeline, qdrant = doc_test_env
    doc_id = "doc-delete-store"

    await store.add(_make_record(doc_id))
    assert await store.get(TEST_USER_ID, doc_id) is not None

    resp = client.delete(f"/documents/{doc_id}", headers=auth_headers)
    assert resp.status_code == 204
    assert await store.get(TEST_USER_ID, doc_id) is None
