from __future__ import annotations

from pathlib import Path

from langchain_community.document_loaders import TextLoader
from langchain_core.documents import Document

SAMPLE_DATA_DIR = Path(__file__).resolve().parent.parent / "sample_data"


def load_sample_documents(directory: Path = SAMPLE_DATA_DIR) -> list[Document]:
    """Load all .md files from *directory* and return a flat list of Documents."""
    docs: list[Document] = []
    for md_file in sorted(directory.glob("*.md")):
        loader = TextLoader(str(md_file), encoding="utf-8")
        docs.extend(loader.load())
    return docs
