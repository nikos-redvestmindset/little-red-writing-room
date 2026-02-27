from pydantic_settings import BaseSettings


class GapDetectionAgentSettings(BaseSettings):
    model: str = "gpt-4o"

    model_config = {"env_prefix": "AGENT_GAP_", "env_file": ".env", "extra": "ignore"}
