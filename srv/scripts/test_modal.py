"""Smoke-test the deployed Modal pipeline with a sample document.

Calls the remote ``process_document`` function synchronously (via
``.remote()``) so Modal logs stream back to the terminal.  No Supabase
writes happen — ``document_id`` and ``user_id`` are left as ``None``.

Uses a dedicated Qdrant collection (``lrwr_chunks_test``) that is
deleted after the run so no test data lingers in production.

Usage:
    uv run python -m scripts.test_modal          # from srv/
    just test-modal                               # from repo root
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

SAMPLE_DOC = (
    Path(__file__).resolve().parent.parent.parent
    / "notebooks"
    / "sample_data"
    / "purplefrog-one-liners.md"
)

TEST_COLLECTION = "lrwr_chunks_test"


def _cleanup_collection() -> None:
    from qdrant_client import QdrantClient

    url = os.environ.get("PIPELINE_QDRANT_URL", "")
    api_key = os.environ.get("PIPELINE_QDRANT_API_KEY", "")
    if not url:
        print("  (skipping cleanup — PIPELINE_QDRANT_URL not set)")
        return

    client = QdrantClient(url=url, api_key=api_key)
    existing = [c.name for c in client.get_collections().collections]
    if TEST_COLLECTION in existing:
        client.delete_collection(TEST_COLLECTION)
        print(f"  Deleted Qdrant collection '{TEST_COLLECTION}'")
    else:
        print(f"  Collection '{TEST_COLLECTION}' not found (nothing to delete)")


def main() -> None:
    import modal

    if not SAMPLE_DOC.exists():
        print(f"ERROR: sample document not found at {SAMPLE_DOC}")
        sys.exit(1)

    content = SAMPLE_DOC.read_text()
    document = {"page_content": content, "metadata": {"source": SAMPLE_DOC.name}}
    known_entities: dict[str, list[str]] = {"character": ["PurpleFrog"]}

    print("Calling Modal function 'process_document' …")
    print(f"  Document   : {SAMPLE_DOC.name} ({len(content)} chars)")
    print(f"  Entities   : {known_entities}")
    print(f"  Collection : {TEST_COLLECTION}")
    print()

    fn = modal.Function.from_name("lrwr-pipeline", "process_document")

    try:
        chunk_count = fn.remote(
            documents=[document],
            known_entities=known_entities,
            pipeline_option="advanced",
            collection_name=TEST_COLLECTION,
        )
        print(f"\nSUCCESS — pipeline produced {chunk_count} chunk(s)")
    except Exception as exc:
        print(f"\nFAILED — {exc}", file=sys.stderr)
        print("\nCleaning up …")
        _cleanup_collection()
        sys.exit(1)

    print("Cleaning up …")
    _cleanup_collection()


if __name__ == "__main__":
    main()
