from typing import Literal

from pydantic_settings import BaseSettings


class TavilyToolSettings(BaseSettings):
    api_key: str = ""
    max_results: int = 5
    search_depth: Literal["basic", "advanced"] = "basic"

    model_config = {"env_prefix": "TOOL_TAVILY_", "env_file": ".env", "extra": "ignore"}
