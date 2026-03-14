"""Smoke-test the deployed Modal pipeline with a sample document.

Calls the remote ``process_document`` function synchronously (via
``.remote()``) so Modal logs stream back to the terminal.  No Supabase
writes happen — ``document_id`` and ``user_id`` are left as ``None``.

Usage:
    uv run python -m scripts.test_modal          # from srv/
    just test-modal                               # from repo root
"""

from __future__ import annotations

import sys
from pathlib import Path

SAMPLE_DOC = (
    Path(__file__).resolve().parent.parent.parent
    / "notebooks"
    / "sample_data"
    / "purplefrog-one-liners.md"
)


def main() -> None:
    import modal

    if not SAMPLE_DOC.exists():
        print(f"ERROR: sample document not found at {SAMPLE_DOC}")
        sys.exit(1)

    content = SAMPLE_DOC.read_text()
    document = {"page_content": content, "metadata": {"source": SAMPLE_DOC.name}}
    known_entities: dict[str, list[str]] = {"character": ["PurpleFrog"]}

    print("Calling Modal function 'process_document' …")
    print(f"  Document : {SAMPLE_DOC.name} ({len(content)} chars)")
    print(f"  Entities : {known_entities}")
    print()

    fn = modal.Function.from_name("lrwr-pipeline", "process_document")

    try:
        chunk_count = fn.remote(
            documents=[document],
            known_entities=known_entities,
            pipeline_option="advanced",
        )
        print(f"\nSUCCESS — pipeline produced {chunk_count} chunk(s)")
    except Exception as exc:
        print(f"\nFAILED — {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
