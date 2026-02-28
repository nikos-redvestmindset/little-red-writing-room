"""Re-export from srv/pipeline/chunking.py (single source of truth).

Requires ``../srv`` on ``sys.path`` — set up in the notebook's setup cell.
"""

from pipeline.chunking import apply_semantic_overlap, prepend_metadata_title

__all__ = ["apply_semantic_overlap", "prepend_metadata_title"]
