from pydantic import BaseModel


class RankedChunk(BaseModel):
    text: str
    source_document: str
    chunk_index: int
    score: float = 1.0


class RetrievalResult(BaseModel):
    ranked_chunks: list[RankedChunk]
    low_confidence: bool = False
    external_references: list[str] = []
