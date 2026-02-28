from __future__ import annotations

import json
import logging

from langchain_classic.retrievers.contextual_compression import ContextualCompressionRetriever
from langchain_cohere import CohereRerank
from langchain_core.tools import tool
from langchain_openai import OpenAIEmbeddings
from langchain_qdrant import QdrantVectorStore
from qdrant_client import QdrantClient

from agents.tools.retrieval.config import RetrievalToolSettings
from agents.tools.retrieval.schemas import RankedChunk, RetrievalResult

logger = logging.getLogger(__name__)


class RetrievalToolBuilder:
    """Builds a LangChain tool for Qdrant vector search + Cohere rerank."""

    def __init__(
        self,
        settings: RetrievalToolSettings,
        qdrant_client: QdrantClient,
        embeddings: OpenAIEmbeddings,
    ) -> None:
        self.settings = settings
        self.qdrant_client = qdrant_client
        self.embeddings = embeddings

    def build(self):
        settings = self.settings
        qdrant = self.qdrant_client
        embeddings = self.embeddings

        @tool
        def retrieval_search(query: str) -> str:
            """Search the writer's uploaded story documents for passages relevant to a query.

            Use this tool for any question about the writer's own characters, scenes,
            settings, worldbuilding, or plot events.  This searches the author's uploaded
            manuscripts and story notes -- NOT general knowledge or writing craft theory.

            When to use:
            - Questions about character traits, motivations, relationships, or backstory
            - Questions about story world rules, settings, factions, or artifacts
            - Questions about specific scenes, dialogue, or plot events
            - "What does PurpleFrog think about..." or "Describe the Underground..."

            When NOT to use:
            - General writing craft questions (use Tavily search instead)
            - Questions about real-world authors, books, or literary theory
            - Questions the writer is asking about their own creative intent (no source needed)

            Args:
                query: A natural language search query describing what information to find.
                    Be specific about character names, scenes, or story elements.
                    Examples: "PurpleFrog's relationship with SnowRaven",
                    "What happens during the evacuation scene",
                    "Description of the Ytterbium Entangler"

            Returns:
                JSON string containing a RetrievalResult with:
                - ranked_chunks: list of text passages with source document, chunk index,
                  and relevance score (highest first, post Cohere rerank)
                - low_confidence: true if no relevant passages were found (triggers gap
                  detection)
                - external_references: named characters or works not from the author's
                  material
            """
            try:
                collections = qdrant.get_collections().collections
                collection_exists = any(c.name == settings.collection_name for c in collections)
            except Exception:
                collection_exists = False

            if not collection_exists:
                logger.warning(
                    "Collection %r does not exist — returning empty result",
                    settings.collection_name,
                )
                empty = RetrievalResult(ranked_chunks=[], low_confidence=True)
                return json.dumps(empty.model_dump())

            vectorstore = QdrantVectorStore(
                client=qdrant,
                collection_name=settings.collection_name,
                embedding=embeddings,
            )
            base_retriever = vectorstore.as_retriever(
                search_kwargs={"k": settings.top_k},
            )

            reranker = CohereRerank(
                model="rerank-v3.5",
                cohere_api_key=settings.cohere_api_key,
            )
            retriever = ContextualCompressionRetriever(
                base_compressor=reranker,
                base_retriever=base_retriever,
            )

            docs = retriever.invoke(query)

            all_external_refs: list[str] = []
            for doc in docs:
                refs = doc.metadata.get("external_references", [])
                if isinstance(refs, list):
                    all_external_refs.extend(refs)

            result = RetrievalResult(
                ranked_chunks=[
                    RankedChunk(
                        text=doc.page_content,
                        source_document=doc.metadata.get("source", "unknown"),
                        chunk_index=i,
                        score=doc.metadata.get("relevance_score", 1.0),
                    )
                    for i, doc in enumerate(docs)
                ],
                low_confidence=len(docs) == 0,
                external_references=list(set(all_external_refs)),
            )
            return json.dumps(result.model_dump())

        return retrieval_search
