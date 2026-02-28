from dependency_injector import containers, providers
from langchain_openai import OpenAIEmbeddings
from qdrant_client import QdrantClient

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
from app.services.document_store import InMemoryDocumentStore, SupabaseDocumentStore
from app.services.progress import InMemoryProgressNotifier, SupabaseProgressNotifier
from pipeline.config import IngestionPipelineSettings
from pipeline.runner import LocalPipelineRunner, ModalPipelineRunner
from pipeline.service import IngestionPipelineService


def _create_pipeline_runner(
    use_modal: bool,
    pipeline: IngestionPipelineService,
):
    if use_modal:
        return ModalPipelineRunner()
    return LocalPipelineRunner(pipeline=pipeline)


def _create_document_store(
    use_supabase: bool,
    supabase_url: str,
    supabase_service_key: str,
):
    if use_supabase:
        return SupabaseDocumentStore(supabase_url, supabase_service_key)
    return InMemoryDocumentStore()


def _create_progress_notifier(
    use_supabase: bool,
    supabase_url: str,
    supabase_service_key: str,
):
    if use_supabase:
        return SupabaseProgressNotifier(supabase_url, supabase_service_key)
    return InMemoryProgressNotifier()


class ApplicationContainer(containers.DeclarativeContainer):
    wiring_config = containers.WiringConfiguration(
        modules=[
            "app.api.routes.chat",
            "app.api.routes.chats",
            "app.api.routes.documents",
        ]
    )

    # ── Settings ──────────────────────────────────────────────────────────
    app_settings = providers.Singleton(AppSettings)
    retrieval_tool_settings = providers.Singleton(RetrievalToolSettings)
    tavily_tool_settings = providers.Singleton(TavilyToolSettings)
    avatar_settings = providers.Singleton(AvatarAgentSettings)
    gap_detection_settings = providers.Singleton(GapDetectionAgentSettings)
    supervisor_settings = providers.Singleton(SupervisorAgentSettings)
    ingestion_settings = providers.Singleton(IngestionPipelineSettings)

    # ── Shared singletons ─────────────────────────────────────────────────
    qdrant_client = providers.Singleton(QdrantClient, location=":memory:")
    embeddings = providers.Singleton(
        OpenAIEmbeddings,
        model=ingestion_settings.provided.embedding_model,
        api_key=app_settings.provided.openai_api_key,
    )

    # ── Tool builders (Factory — stateless, new per request) ──────────────
    retrieval_tool_builder = providers.Factory(
        RetrievalToolBuilder,
        settings=retrieval_tool_settings,
        qdrant_client=qdrant_client,
        embeddings=embeddings,
    )
    tavily_tool_builder = providers.Factory(
        TavilyToolBuilder,
        settings=tavily_tool_settings,
    )

    # ── Ingestion pipeline ────────────────────────────────────────────────
    ingestion_pipeline = providers.Factory(
        IngestionPipelineService,
        settings=ingestion_settings,
        qdrant_client=qdrant_client,
        embeddings=embeddings,
        openai_api_key=app_settings.provided.openai_api_key,
    )

    ingestion_runner = providers.Factory(
        _create_pipeline_runner,
        use_modal=ingestion_settings.provided.use_modal,
        pipeline=ingestion_pipeline,
    )

    # ── Document store & progress notifier (Singleton — config-selectable) ─
    document_store = providers.Singleton(
        _create_document_store,
        use_supabase=app_settings.provided.use_supabase_storage,
        supabase_url=app_settings.provided.supabase_url,
        supabase_service_key=app_settings.provided.supabase_service_key,
    )

    progress_notifier = providers.Singleton(
        _create_progress_notifier,
        use_supabase=app_settings.provided.use_supabase_storage,
        supabase_url=app_settings.provided.supabase_url,
        supabase_service_key=app_settings.provided.supabase_service_key,
    )

    # ── Sub-agent builders (Factory — produce CompiledStateGraphs) ────────
    avatar_agent_builder = providers.Factory(
        AvatarAgentBuilder,
        settings=avatar_settings,
        openai_api_key=app_settings.provided.openai_api_key,
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
