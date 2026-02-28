from pydantic_settings import BaseSettings


class AppSettings(BaseSettings):
    cors_origins: str = "http://localhost:3003"
    supabase_url: str
    supabase_service_key: str
    openai_api_key: str = ""
    llm_model: str = "gpt-4o"
    use_supabase_storage: bool = False

    model_config = {"env_prefix": "APP_", "env_file": ".env", "extra": "ignore"}
