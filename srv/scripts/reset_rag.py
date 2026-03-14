"""Reset all RAG state: Qdrant vectors, extraction tracking, and document status.

Atomically wipes:
  1. The Qdrant collection (deleted and recreated empty with indexes)
  2. ``document_entity_extractions`` rows in Supabase
  3. ``processing_jobs`` rows in Supabase
  4. All documents' extraction state (status -> "uploaded", chunks_stored -> 0)

WARNING: This is destructive and irreversible.

Usage:
    uv run python -m scripts.reset_rag          # from srv/
    just reset-rag                               # from repo root
"""

from __future__ import annotations

import os
import sys
import warnings


def _reset_qdrant(collection: str) -> None:
    from langchain_openai import OpenAIEmbeddings
    from qdrant_client import QdrantClient, models

    url = os.environ.get("PIPELINE_QDRANT_URL", "")
    api_key = os.environ.get("PIPELINE_QDRANT_API_KEY", "")
    embedding_model = os.environ.get("PIPELINE_EMBEDDING_MODEL", "text-embedding-3-small")

    if not url:
        print("ERROR: PIPELINE_QDRANT_URL is not set.")
        sys.exit(1)

    client = QdrantClient(url=url, api_key=api_key)

    existing = [c.name for c in client.get_collections().collections]
    if collection in existing:
        client.delete_collection(collection)
        print(f"  Deleted Qdrant collection '{collection}'")
    else:
        print(f"  Collection '{collection}' does not exist yet")

    openai_key = os.environ.get("APP_OPENAI_API_KEY") or os.environ.get("OPENAI_API_KEY", "")
    embeddings = OpenAIEmbeddings(model=embedding_model, api_key=openai_key)
    dim = len(embeddings.embed_query("dimension probe"))

    client.create_collection(
        collection_name=collection,
        vectors_config=models.VectorParams(size=dim, distance=models.Distance.COSINE),
    )
    print(f"  Created empty collection '{collection}' (dim={dim})")

    payload_indexes = ("metadata.document_id", "metadata.user_id")
    for field in payload_indexes:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", UserWarning)
            client.create_payload_index(
                collection_name=collection,
                field_name=field,
                field_schema=models.PayloadSchemaType.KEYWORD,
            )
    print(f"  Created payload indexes: {', '.join(payload_indexes)}")


def _reset_supabase() -> None:
    from supabase import create_client

    url = os.environ.get("APP_SUPABASE_URL", "")
    key = os.environ.get("APP_SUPABASE_SERVICE_KEY", "")
    if not url or not key:
        print("ERROR: APP_SUPABASE_URL / APP_SUPABASE_SERVICE_KEY not set.")
        sys.exit(1)

    sb = create_client(url, key)

    NIL_UUID = "00000000-0000-0000-0000-000000000000"

    sb.table("document_entity_extractions").delete().neq("document_id", NIL_UUID).execute()
    print("  Cleared document_entity_extractions")

    sb.table("processing_jobs").delete().neq("document_id", NIL_UUID).execute()
    print("  Cleared processing_jobs")

    sb.table("documents").update({
        "status": "uploaded",
        "chunks_stored": 0,
        "error_message": None,
    }).in_("status", ["extracted", "error", "processing"]).execute()
    print("  Reset document statuses to 'uploaded'")


def main() -> None:
    collection = os.environ.get("PIPELINE_COLLECTION_NAME", "lrwr_chunks")

    print(f"Resetting RAG state (collection={collection}) …\n")

    print("[1/2] Qdrant")
    _reset_qdrant(collection)

    print("\n[2/2] Supabase")
    _reset_supabase()

    print("\nDone — all extraction state has been wiped.")


if __name__ == "__main__":
    main()
