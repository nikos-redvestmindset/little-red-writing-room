from pydantic_settings import BaseSettings


class IngestionPipelineSettings(BaseSettings):
    collection_name: str = "lrwr_chunks"
    embedding_model: str = "text-embedding-3-small"
    classification_model: str = "gpt-4.1-mini"
    classification_max_tokens: int = 500
    chunk_size: int = 500
    chunk_overlap: int = 50
    overlap_sentences: int = 3
    use_modal: bool = False

    model_config = {"env_prefix": "PIPELINE_", "env_file": ".env", "extra": "ignore"}
