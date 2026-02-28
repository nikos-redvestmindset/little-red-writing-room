"""Re-export from srv/pipeline/classification.py (single source of truth).

Requires ``../srv`` on ``sys.path`` — set up in the notebook's setup cell.
"""

from pipeline.classification import ChunkClassification, classify_chunks

__all__ = ["ChunkClassification", "classify_chunks"]
