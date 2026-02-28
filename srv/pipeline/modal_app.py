"""Modal deployment definition for the ingestion pipeline.

This file is a deployment artifact — it is only used when deploying the
pipeline to Modal::

    modal deploy srv/pipeline/modal_app.py

It is **never** imported by the FastAPI application.  The FastAPI server
communicates with this deployed function via ``ModalPipelineRunner``,
which calls ``modal.Function.from_name("lrwr-pipeline", "process_document")``.

Skeleton only — will be fleshed out when remote Qdrant and Supabase Storage
are integrated.
"""

from __future__ import annotations

import modal

app = modal.App("lrwr-pipeline")

image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "langchain",
    "langchain-core",
    "langchain-openai",
    "langchain-qdrant",
    "langchain-cohere",
    "langchain-experimental",
    "langchain-text-splitters",
    "qdrant-client",
    "pydantic-settings",
)


@app.function(image=image, timeout=600)
async def process_document(
    documents: list[dict],
    known_characters: list[str],
    pipeline_option: str,
) -> int:
    """Modal entry point.

    Instantiates the pipeline with remote Qdrant settings and runs it.
    Called by ``ModalPipelineRunner.run()`` via ``modal.Function.spawn()``.
    """
    from langchain_core.documents import Document
    from langchain_openai import OpenAIEmbeddings
    from qdrant_client import QdrantClient

    from pipeline.config import IngestionPipelineSettings
    from pipeline.service import IngestionPipelineService

    settings = IngestionPipelineSettings()
    qdrant_client = QdrantClient(
        url=settings.qdrant_url,  # type: ignore[attr-defined]
        api_key=settings.qdrant_api_key,  # type: ignore[attr-defined]
    )
    embeddings = OpenAIEmbeddings(model=settings.embedding_model)

    pipeline = IngestionPipelineService(
        settings=settings,
        qdrant_client=qdrant_client,
        embeddings=embeddings,
    )

    docs = [Document(**d) for d in documents]
    return await pipeline.ingest(docs, known_characters, pipeline_option)
