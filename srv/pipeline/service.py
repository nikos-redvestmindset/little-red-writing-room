from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable

from langchain_core.documents import Document
from langchain_experimental.text_splitter import SemanticChunker
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_qdrant import QdrantVectorStore
from langchain_text_splitters import RecursiveCharacterTextSplitter
from qdrant_client import QdrantClient, models

from pipeline.chunking import apply_semantic_overlap, prepend_metadata_title
from pipeline.classification import classify_chunks_async
from pipeline.config import IngestionPipelineSettings

logger = logging.getLogger(__name__)

ProgressCallback = Callable[[str, int, int | None, int | None], Awaitable[None]]


class IngestionPipelineService:
    """Orchestrates document ingestion into the Qdrant vector store.

    Supports two pipeline options:

    - **baseline** (Option A): ``RecursiveCharacterTextSplitter`` + dense
      vector upsert.  No LLM calls during ingestion.
    - **advanced** (Option B): ``SemanticChunker`` + content overlap + LLM
      taxonomy classification + metadata-titled chunks + dense vector upsert.

    This class is pure Python with no Modal dependency.  It is called
    directly by ``LocalPipelineRunner`` or instantiated inside a Modal
    function by ``modal_app.py``.
    """

    def __init__(
        self,
        settings: IngestionPipelineSettings,
        qdrant_client: QdrantClient,
        embeddings: OpenAIEmbeddings,
        openai_api_key: str = "",
    ) -> None:
        self._settings = settings
        self._qdrant_client = qdrant_client
        self._embeddings = embeddings
        self._openai_api_key = openai_api_key

    async def ingest(
        self,
        documents: list[Document],
        known_entities: dict[str, list[str]],
        pipeline_option: str = "advanced",
        on_progress: ProgressCallback | None = None,
        document_id: str | None = None,
        user_id: str | None = None,
    ) -> int:
        """Run the full ingestion pipeline and return the number of chunks stored.

        Args:
            documents: Raw LangChain ``Document`` objects (one per uploaded file).
            known_entities: Dict keyed by entity type (e.g. ``"character"``,
                ``"location"``) mapping to canonical names for resolution
                in the classification pass.
            pipeline_option: ``"baseline"`` or ``"advanced"``.
            on_progress: Optional async callback fired at each pipeline stage.
            document_id: If provided, injected into chunk metadata for scoped
                retrieval and deletion.
            user_id: If provided, injected into chunk metadata.
        """
        if on_progress:
            await on_progress("chunking", 10, None, None)

        if pipeline_option == "baseline":
            chunks = self._baseline_chunk(documents)
        elif pipeline_option == "advanced":
            chunks = await self._advanced_chunk(documents, known_entities, on_progress)
        else:
            raise ValueError(f"Unknown pipeline_option: {pipeline_option!r}")

        if document_id or user_id:
            for chunk in chunks:
                if document_id:
                    chunk.metadata["document_id"] = document_id
                if user_id:
                    chunk.metadata["user_id"] = user_id

        if on_progress:
            await on_progress("embedding", 85, len(chunks), None)

        logger.info(
            "Upserting %d chunks into collection %r",
            len(chunks),
            self._settings.collection_name,
        )
        self._upsert(chunks)

        if on_progress:
            await on_progress("complete", 100, len(chunks), len(chunks))

        return len(chunks)

    def delete_document_chunks(self, document_id: str, user_id: str) -> None:
        """Delete all Qdrant points belonging to a specific document.

        Metadata keys are nested under ``metadata.`` because
        ``QdrantVectorStore.add_documents`` stores LangChain Document
        metadata in a ``metadata`` payload namespace.
        """
        self._ensure_collection()
        self._qdrant_client.delete(
            collection_name=self._settings.collection_name,
            points_selector=models.FilterSelector(
                filter=models.Filter(
                    must=[
                        models.FieldCondition(
                            key="metadata.document_id",
                            match=models.MatchValue(value=document_id),
                        ),
                        models.FieldCondition(
                            key="metadata.user_id",
                            match=models.MatchValue(value=user_id),
                        ),
                    ]
                )
            ),
        )
        logger.info(
            "Deleted chunks for document_id=%s user_id=%s", document_id, user_id,
        )

    # ------------------------------------------------------------------
    # Pipeline stages
    # ------------------------------------------------------------------

    def _baseline_chunk(self, documents: list[Document]) -> list[Document]:
        """Option A: fixed-size recursive character splitting."""
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=self._settings.chunk_size,
            chunk_overlap=self._settings.chunk_overlap,
            separators=["\n\n", "\n", ".", " "],
        )
        chunks = splitter.split_documents(documents)
        logger.info("Baseline chunking: %d chunks", len(chunks))
        return chunks

    async def _advanced_chunk(
        self,
        documents: list[Document],
        known_entities: dict[str, list[str]],
        on_progress: ProgressCallback | None = None,
    ) -> list[Document]:
        """Option B: semantic chunking + overlap + LLM classification + metadata title."""
        chunker = SemanticChunker(
            self._embeddings,
            breakpoint_threshold_type="percentile",
        )
        chunks = chunker.split_documents(documents)
        logger.info("Semantic chunking: %d chunks", len(chunks))

        chunks = apply_semantic_overlap(chunks, overlap_sentences=self._settings.overlap_sentences)
        logger.info("Applied %d-sentence overlap", self._settings.overlap_sentences)

        if on_progress:
            await on_progress("classifying", 25, len(chunks), 0)

        async def _on_chunk_classified(processed: int, total: int) -> None:
            if on_progress:
                pct = 25 + int(55 * processed / total)
                await on_progress("classifying", pct, total, processed)

        classification_llm = ChatOpenAI(
            model=self._settings.classification_model,
            max_completion_tokens=self._settings.classification_max_tokens,
            api_key=self._openai_api_key or None,
        )
        chunks = await classify_chunks_async(
            chunks, known_entities, classification_llm,
            on_chunk_classified=_on_chunk_classified,
        )
        logger.info("Classification complete")

        chunks = prepend_metadata_title(chunks)
        logger.info("Metadata titles prepended")

        return chunks

    def _upsert(self, chunks: list[Document]) -> None:
        """Embed chunks and upsert into Qdrant using the shared client."""
        self._ensure_collection()
        vectorstore = QdrantVectorStore(
            client=self._qdrant_client,
            collection_name=self._settings.collection_name,
            embedding=self._embeddings,
        )
        vectorstore.add_documents(chunks)

    _PAYLOAD_INDEXES = ("metadata.document_id", "metadata.user_id")

    def _ensure_collection(self) -> None:
        """Create the Qdrant collection (if missing) and ensure payload indexes.

        Indexes use ``metadata.`` prefix because ``QdrantVectorStore``
        nests LangChain Document metadata under a ``metadata`` key.
        In-memory Qdrant silently ignores index creation (not needed).
        """
        collections = self._qdrant_client.get_collections().collections
        exists = any(c.name == self._settings.collection_name for c in collections)

        if not exists:
            sample_vec = self._embeddings.embed_query("dimension probe")
            self._qdrant_client.create_collection(
                collection_name=self._settings.collection_name,
                vectors_config=models.VectorParams(
                    size=len(sample_vec),
                    distance=models.Distance.COSINE,
                ),
            )

        collection_info = self._qdrant_client.get_collection(
            self._settings.collection_name
        )
        existing_indexes = set(collection_info.payload_schema.keys())

        for field in self._PAYLOAD_INDEXES:
            if field not in existing_indexes:
                try:
                    self._qdrant_client.create_payload_index(
                        collection_name=self._settings.collection_name,
                        field_name=field,
                        field_schema=models.PayloadSchemaType.KEYWORD,
                    )
                except Exception:
                    pass
