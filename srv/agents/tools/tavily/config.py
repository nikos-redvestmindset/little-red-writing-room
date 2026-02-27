from pydantic_settings import BaseSettings


class TavilyToolSettings(BaseSettings):
    api_key: str = ""

    model_config = {"env_prefix": "TOOL_TAVILY_", "env_file": ".env", "extra": "ignore"}
