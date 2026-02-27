from dependency_injector import containers, providers

from agents.avatar.agent import AvatarAgentBuilder
from agents.avatar.config import AvatarAgentSettings
from agents.gap_detection.agent import GapDetectionAgentBuilder
from agents.gap_detection.config import GapDetectionAgentSettings
from agents.session.service import AvatarSessionService
from agents.supervisor.agent import SupervisorAgentBuilder
from agents.supervisor.config import SupervisorAgentSettings
from agents.tools.retrieval.config import RetrievalToolSettings
from agents.tools.retrieval.tool import RetrievalToolBuilder
from agents.tools.tavily.config import TavilyToolSettings
from agents.tools.tavily.tool import TavilyToolBuilder
from app.config import AppSettings


class ApplicationContainer(containers.DeclarativeContainer):
    wiring_config = containers.WiringConfiguration(
        modules=[
            "app.api.routes.chat",
            "app.api.routes.chats",
        ]
    )

    # ── Settings ──────────────────────────────────────────────────────────
    app_settings = providers.Singleton(AppSettings)
    retrieval_tool_settings = providers.Singleton(RetrievalToolSettings)
    tavily_tool_settings = providers.Singleton(TavilyToolSettings)
    avatar_settings = providers.Singleton(AvatarAgentSettings)
    gap_detection_settings = providers.Singleton(GapDetectionAgentSettings)
    supervisor_settings = providers.Singleton(SupervisorAgentSettings)

    # ── Tool builders (Factory — stateless, new per request) ──────────────
    retrieval_tool_builder = providers.Factory(
        RetrievalToolBuilder,
        settings=retrieval_tool_settings,
    )
    tavily_tool_builder = providers.Factory(
        TavilyToolBuilder,
        settings=tavily_tool_settings,
    )

    # ── Sub-agent builders (Factory — produce CompiledStateGraphs) ────────
    avatar_agent_builder = providers.Factory(
        AvatarAgentBuilder,
        settings=avatar_settings,
    )
    gap_detection_builder = providers.Factory(
        GapDetectionAgentBuilder,
        settings=gap_detection_settings,
    )

    # ── Supervisor (Factory) — receives all tool and sub-agent builders ───
    supervisor_agent = providers.Factory(
        SupervisorAgentBuilder,
        settings=supervisor_settings,
        retrieval_tool_builder=retrieval_tool_builder,
        tavily_tool_builder=tavily_tool_builder,
        avatar_agent_builder=avatar_agent_builder,
        gap_detection_builder=gap_detection_builder,
    )

    # ── Session service (Factory) ─────────────────────────────────────────
    avatar_session_service = providers.Factory(
        AvatarSessionService,
        supervisor_builder=supervisor_agent,
        supabase_url=app_settings.provided.supabase_url,
        supabase_service_key=app_settings.provided.supabase_service_key,
    )
