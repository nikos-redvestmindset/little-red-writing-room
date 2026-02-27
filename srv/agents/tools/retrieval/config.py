from pydantic_settings import BaseSettings


class RetrievalToolSettings(BaseSettings):
    qdrant_url: str = "https://localhost:6333"
    qdrant_api_key: str = ""
    collection_name: str = "lrwr_chunks"
    top_k: int = 10
    cohere_api_key: str = ""

    model_config = {"env_prefix": "TOOL_RETRIEVAL_", "env_file": ".env", "extra": "ignore"}
