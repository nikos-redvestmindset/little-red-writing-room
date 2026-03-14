"""Modal deployment definition for the ingestion pipeline.

This file is a deployment artifact — it is only used when deploying the
pipeline to Modal::

    modal deploy srv/pipeline/modal_app.py

It is **never** imported by the FastAPI application.  The FastAPI server
communicates with this deployed function via ``ModalPipelineRunner``,
which calls ``modal.Function.from_name("lrwr-pipeline", "process_document")``.
"""

from __future__ import annotations

import logging

import modal

logger = logging.getLogger(__name__)

app = modal.App("lrwr-pipeline")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "langchain",
        "langchain-core",
        "langchain-openai",
        "langchain-qdrant",
        "langchain-cohere",
        "langchain-experimental",
        "langchain-text-splitters",
        "qdrant-client",
        "pydantic-settings",
        "supabase",
    )
    .add_local_python_source("pipeline")
)

PROCESSING_JOBS_TABLE = "processing_jobs"
EXTRACTION_TRACKING_TABLE = "document_entity_extractions"


def _notify_progress(supabase, document_id: str, **fields) -> None:
    """Write progress fields to processing_jobs; the DB trigger fires pg_notify."""
    supabase.table(PROCESSING_JOBS_TABLE).update(fields).eq(
        "document_id", document_id
    ).execute()


@app.function(
    image=image,
    timeout=600,
    secrets=[modal.Secret.from_name("lrwr-env")],
)
async def process_document(
    documents: list[dict],
    known_entities: dict[str, list[str]],
    pipeline_option: str,
    document_id: str | None = None,
    user_id: str | None = None,
    selected_entity_ids: list[str] | None = None,
    collection_name: str | None = None,
) -> int:
    """Modal entry point.

    Instantiates the pipeline with remote Qdrant settings and runs it.
    Reports progress by writing directly to the ``processing_jobs`` table
    (whose trigger fires ``pg_notify``).
    On completion, updates the ``documents`` status and writes extraction
    tracking rows.

    Called by ``ModalPipelineRunner.run()`` via ``modal.Function.spawn()``.
    """
    import os

    from supabase import create_client

    supabase_url = os.environ.get("APP_SUPABASE_URL", "")
    supabase_key = os.environ.get("APP_SUPABASE_SERVICE_KEY", "")
    supabase = create_client(supabase_url, supabase_key)

    from langchain_core.documents import Document
    from langchain_openai import OpenAIEmbeddings
    from qdrant_client import QdrantClient

    from pipeline.config import IngestionPipelineSettings
    from pipeline.service import IngestionPipelineService

    settings = IngestionPipelineSettings()
    if collection_name:
        settings.collection_name = collection_name

    qdrant_client = QdrantClient(
        url=settings.qdrant_url,
        api_key=settings.qdrant_api_key,
    )
    embeddings = OpenAIEmbeddings(model=settings.embedding_model)

    pipeline = IngestionPipelineService(
        settings=settings,
        qdrant_client=qdrant_client,
        embeddings=embeddings,
    )

    async def _on_progress(
        stage: str,
        progress_pct: int,
        chunks_total: int | None,
        chunks_processed: int | None,
    ) -> None:
        if document_id:
            _notify_progress(
                supabase, document_id,
                current_stage=stage,
                progress_pct=progress_pct,
                chunks_total=chunks_total,
                chunks_processed=chunks_processed,
            )

    try:
        docs = [Document(**d) for d in documents]
        chunk_count = await pipeline.ingest(
            docs, known_entities, pipeline_option,
            on_progress=_on_progress,
            document_id=document_id,
            user_id=user_id,
        )

        if document_id and user_id:
            supabase.table("documents").update(
                {"status": "extracted", "chunks_stored": chunk_count}
            ).eq("id", document_id).eq("user_id", user_id).execute()

            entity_ids = selected_entity_ids or []
            if entity_ids:
                all_names = sorted(
                    n for names in known_entities.values() for n in names
                )
                source = docs[0].metadata.get("source", "") if docs else ""
                note = f"{', '.join(all_names)} from {source}" if all_names else ""

                supabase.table(EXTRACTION_TRACKING_TABLE).delete().eq(
                    "document_id", document_id
                ).eq("user_id", user_id).execute()

                rows = [
                    {
                        "document_id": document_id,
                        "entity_id": eid,
                        "user_id": user_id,
                        "note": note,
                    }
                    for eid in entity_ids
                ]
                supabase.table(EXTRACTION_TRACKING_TABLE).insert(rows).execute()

        return chunk_count

    except Exception:
        logger.exception("Pipeline failed on Modal for document %s", document_id)
        if document_id:
            _notify_progress(
                supabase, document_id,
                current_stage="failed",
                progress_pct=0,
                message="Pipeline failed",
            )
            if user_id:
                supabase.table("documents").update(
                    {"status": "error", "error_message": "Pipeline failed"}
                ).eq("id", document_id).eq("user_id", user_id).execute()
        raise
