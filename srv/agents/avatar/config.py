from pydantic_settings import BaseSettings


class AvatarAgentSettings(BaseSettings):
    model: str = "gpt-4o"

    model_config = {"env_prefix": "AGENT_AVATAR_", "env_file": ".env", "extra": "ignore"}
