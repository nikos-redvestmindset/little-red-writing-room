from pydantic_settings import BaseSettings


class SupervisorAgentSettings(BaseSettings):
    model: str = "gpt-4o"
    history_window: int = 20

    model_config = {"env_prefix": "AGENT_SUPERVISOR_", "env_file": ".env", "extra": "ignore"}
