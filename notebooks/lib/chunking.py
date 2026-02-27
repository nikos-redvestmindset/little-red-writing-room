from __future__ import annotations

import re

from langchain_core.documents import Document


def _split_sentences(text: str) -> list[str]:
    """Split *text* into sentences on '.', '!', or '?' boundaries."""
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return [p for p in parts if p]


def apply_semantic_overlap(
    chunks: list[Document],
    overlap_sentences: int = 3,
) -> list[Document]:
    """Prepend a sliding window of sentences from each chunk's predecessor.

    For every chunk at index ``i > 0``, the last ``overlap_sentences`` sentences
    of the *original* ``page_content`` of chunk ``i-1`` are prepended to chunk
    ``i``. Chunk 0 is returned unchanged.

    The overlap is always sourced from the original text, never from an
    already-overlapped version, so the prefix does not compound across hops.

    Metadata is preserved as-is; ``overlap_sentence_count`` is added to
    every returned document for observability (0 for chunk 0).

    Args:
        chunks: Ordered list of documents produced by a text splitter.
        overlap_sentences: Number of sentences to borrow from the previous chunk.

    Returns:
        A new list of ``Document`` objects the same length as *chunks*.
    """
    if not chunks:
        return []

    result: list[Document] = []

    for i, chunk in enumerate(chunks):
        if i == 0:
            result.append(
                Document(
                    page_content=chunk.page_content,
                    metadata={**chunk.metadata, "overlap_sentence_count": 0},
                )
            )
            continue

        prev_sentences = _split_sentences(chunks[i - 1].page_content)
        tail = prev_sentences[-overlap_sentences:] if overlap_sentences > 0 else []

        if tail:
            prefix = " ".join(tail)
            new_content = prefix + "\n\n" + chunk.page_content
        else:
            new_content = chunk.page_content

        result.append(
            Document(
                page_content=new_content,
                metadata={
                    **chunk.metadata,
                    "overlap_sentence_count": len(tail),
                },
            )
        )

    return result
