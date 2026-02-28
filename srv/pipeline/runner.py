from __future__ import annotations

import logging
from typing import Protocol

from langchain_core.documents import Document

from pipeline.service import IngestionPipelineService, ProgressCallback

logger = logging.getLogger(__name__)


class PipelineRunner(Protocol):
    """Protocol for pipeline execution backends."""

    async def run(
        self,
        documents: list[Document],
        known_characters: list[str],
        pipeline_option: str,
        on_progress: ProgressCallback | None = None,
    ) -> int: ...


class LocalPipelineRunner:
    """Runs the ingestion pipeline in-process.

    Used for local development and when Qdrant is in-memory.
    """

    def __init__(self, pipeline: IngestionPipelineService) -> None:
        self._pipeline = pipeline

    async def run(
        self,
        documents: list[Document],
        known_characters: list[str],
        pipeline_option: str,
        on_progress: ProgressCallback | None = None,
    ) -> int:
        logger.info("Running pipeline locally (in-process)")
        return await self._pipeline.ingest(
            documents, known_characters, pipeline_option,
            on_progress=on_progress,
        )


class ModalPipelineRunner:
    """Spawns the ingestion pipeline on Modal.

    Used in production with remote Qdrant.  The ``modal`` package is lazily
    imported so that it is never required at startup when ``use_modal=False``.
    """

    def __init__(self, modal_function_name: str = "process_document") -> None:
        self._function_name = modal_function_name

    async def run(
        self,
        documents: list[Document],
        known_characters: list[str],
        pipeline_option: str,
        on_progress: ProgressCallback | None = None,
    ) -> int:
        import modal  # lazy import -- only needed when use_modal=True

        logger.info("Spawning pipeline on Modal (function=%s)", self._function_name)
        fn = modal.Function.from_name("lrwr-pipeline", self._function_name)
        fn.spawn(
            documents=[doc.model_dump() for doc in documents],
            known_characters=known_characters,
            pipeline_option=pipeline_option,
        )
        return 0
