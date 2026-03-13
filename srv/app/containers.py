from dependency_injector import containers, providers
from langchain_openai import OpenAIEmbeddings
from langgraph.checkpoint.memory import MemorySaver
from qdrant_client import QdrantClient
from supabase import Client, create_client

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
from app.story_entities.service import StoryEntityService
from pipeline.config import IngestionPipelineSettings
from pipeline.runner import LocalPipelineRunner, ModalPipelineRunner
from pipeline.service import IngestionPipelineService


def _create_qdrant_client(qdrant_url: str, qdrant_api_key: str) -> QdrantClient:
    if qdrant_url:
        return QdrantClient(url=qdrant_url, api_key=qdrant_api_key)
    return QdrantClient(location=":memory:")


def _create_pipeline_runner(
    use_modal: bool,
    pipeline: IngestionPipelineService,
):
    if use_modal:
        return ModalPipelineRunner()
    return LocalPipelineRunner(pipeline=pipeline)


def _create_document_store(
    app_env: str,
    supabase_client: Client,
):
    if app_env == "local":
        return InMemoryDocumentStore()
    return SupabaseDocumentStore(client=supabase_client)


def _create_progress_notifier(
    app_env: str,
    supabase_client: Client,
):
    if app_env == "local":
        return InMemoryProgressNotifier()
    return SupabaseProgressNotifier(client=supabase_client)


class ApplicationContainer(containers.DeclarativeContainer):
    wiring_config = containers.WiringConfiguration(
        modules=[
            "app.api.routes.story_entities",
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
    supabase_client = providers.Singleton(
        create_client,
        supabase_url=app_settings.provided.supabase_url,
        supabase_key=app_settings.provided.supabase_service_key,
    )
    qdrant_client = providers.Singleton(
        _create_qdrant_client,
        qdrant_url=ingestion_settings.provided.qdrant_url,
        qdrant_api_key=ingestion_settings.provided.qdrant_api_key,
    )
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

    # ── Document store & progress notifier (Singleton — env-selectable) ────
    document_store = providers.Singleton(
        _create_document_store,
        app_env=app_settings.provided.env,
        supabase_client=supabase_client,
    )

    progress_notifier = providers.Singleton(
        _create_progress_notifier,
        app_env=app_settings.provided.env,
        supabase_client=supabase_client,
    )

    # ── Story entities ─────────────────────────────────────────────────────
    story_entity_service = providers.Factory(
        StoryEntityService,
        client=supabase_client,
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

    # ── Memory (Singleton — swap to PostgresSaver for Supabase persistence) ─
    checkpointer = providers.Singleton(MemorySaver)

    # ── Supervisor (Factory) — receives all tool and sub-agent builders ───
    supervisor_agent = providers.Factory(
        SupervisorAgentBuilder,
        settings=supervisor_settings,
        retrieval_tool_builder=retrieval_tool_builder,
        tavily_tool_builder=tavily_tool_builder,
        avatar_agent_builder=avatar_agent_builder,
        gap_detection_builder=gap_detection_builder,
        checkpointer=checkpointer,
    )

    # ── Session service (Factory) ─────────────────────────────────────────
    avatar_session_service = providers.Factory(
        AvatarSessionService,
        supervisor_builder=supervisor_agent,
        supabase_client=supabase_client,
    )
