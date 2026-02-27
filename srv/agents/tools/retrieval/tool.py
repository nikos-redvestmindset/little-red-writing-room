import json

from langchain_core.tools import tool

from agents.tools.retrieval.config import RetrievalToolSettings
from agents.tools.retrieval.schemas import RankedChunk, RetrievalResult


class RetrievalToolBuilder:
    """Builds a LangChain tool for Qdrant vector search + Cohere rerank.

    Currently returns dummy results for end-to-end testing.
    """

    def __init__(self, settings: RetrievalToolSettings) -> None:
        self.settings = settings

    def build(self):
        @tool
        def retrieval_search(query: str) -> str:
            """Search uploaded story documents for passages relevant to the query.

            Use for questions about characters, scenes, settings, or any content
            the author has uploaded. NOT for general knowledge or writing craft theory.
            """
            dummy_result = RetrievalResult(
                ranked_chunks=[
                    RankedChunk(
                        text=(
                            "PurpleFrog's core drive: protect SnowRaven at any cost. "
                            "Authority is an obstacle, never a guide."
                        ),
                        source_document="purplefrog-story-notes.md",
                        chunk_index=0,
                        score=0.95,
                    ),
                ],
                low_confidence=False,
                external_references=[],
            )
            return json.dumps(dummy_result.model_dump())

        return retrieval_search
