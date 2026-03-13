from typing import Literal

from pydantic_settings import BaseSettings


class AppSettings(BaseSettings):
    env: Literal["local", "dev", "staging", "prod"] = "local"
    cors_origins: str = "http://localhost:3003"
    supabase_url: str
    supabase_service_key: str
    openai_api_key: str = ""
    llm_model: str = "gpt-4o"

    @property
    def is_local(self) -> bool:
        return self.env == "local"

    model_config = {"env_prefix": "APP_", "env_file": ".env", "extra": "ignore"}
