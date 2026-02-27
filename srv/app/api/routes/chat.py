from dependency_injector.wiring import Provide, inject
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from agents.session.service import AvatarSessionService
from app.auth import verify_supabase_jwt
from app.containers import ApplicationContainer

router = APIRouter()
security = HTTPBearer()


class ChatStreamRequest(BaseModel):
    chat_id: str
    character_id: str
    message: str


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    payload = verify_supabase_jwt(credentials.credentials)
    return payload["sub"]


@router.post("/stream")
@inject
async def chat_stream(
    body: ChatStreamRequest,
    user_id: str = Depends(get_current_user_id),
    session_service: AvatarSessionService = Depends(
        Provide[ApplicationContainer.avatar_session_service]
    ),
) -> StreamingResponse:
    await session_service.assert_chat_owner(
        chat_id=body.chat_id,
        user_id=user_id,
    )

    return StreamingResponse(
        session_service.stream(
            chat_id=body.chat_id,
            user_id=user_id,
            character_id=body.character_id,
            message=body.message,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
