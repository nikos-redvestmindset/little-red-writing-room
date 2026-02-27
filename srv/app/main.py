from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.containers import ApplicationContainer


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


def create_app() -> FastAPI:
    container = ApplicationContainer()

    app = FastAPI(title="Little Red Writing Room", lifespan=lifespan)
    app.state.container = container

    settings = container.app_settings()
    origins = [o.strip() for o in settings.cors_origins.split(",")]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    from app.api.routes import chat, chats, health

    app.include_router(chat.router, prefix="/chat")
    app.include_router(chats.router)
    app.include_router(health.router)

    return app


app = create_app()
