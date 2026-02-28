import logging
from typing import Optional

from dependency_injector.wiring import Provide, inject
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from agents.session.service import AvatarSessionService
from app.api.deps import get_current_user_id
from app.containers import ApplicationContainer

logger = logging.getLogger(__name__)

router = APIRouter()


class ChatCreate(BaseModel):
    chat_id: str
    character_id: str
    title: Optional[str] = None


class ChatUpdate(BaseModel):
    title: str


@router.get("/chats")
@inject
async def list_chats(
    user_id: str = Depends(get_current_user_id),
    session_service: AvatarSessionService = Depends(
        Provide[ApplicationContainer.avatar_session_service]
    ),
) -> list[dict]:
    client = session_service.get_supabase_client()
    result = (
        client.table("chats")
        .select("id, character_id, title, created_at, updated_at")
        .eq("user_id", user_id)
        .order("updated_at", desc=True)
        .execute()
    )
    return result.data


@router.post("/chats", status_code=201)
@inject
async def create_chat(
    body: ChatCreate,
    user_id: str = Depends(get_current_user_id),
    session_service: AvatarSessionService = Depends(
        Provide[ApplicationContainer.avatar_session_service]
    ),
) -> dict:
    client = session_service.get_supabase_client()
    result = (
        client.table("chats")
        .insert(
            {
                "id": body.chat_id,
                "user_id": user_id,
                "character_id": body.character_id,
                "title": body.title,
            }
        )
        .execute()
    )
    return result.data[0]


@router.patch("/chats/{chat_id}")
@inject
async def rename_chat(
    chat_id: str,
    body: ChatUpdate,
    user_id: str = Depends(get_current_user_id),
    session_service: AvatarSessionService = Depends(
        Provide[ApplicationContainer.avatar_session_service]
    ),
) -> dict:
    client = session_service.get_supabase_client()
    result = (
        client.table("chats")
        .update({"title": body.title})
        .eq("id", chat_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=403, detail="Chat not found or access denied")
    return result.data[0]


@router.delete("/chats/{chat_id}", status_code=204)
@inject
async def delete_chat(
    chat_id: str,
    user_id: str = Depends(get_current_user_id),
    session_service: AvatarSessionService = Depends(
        Provide[ApplicationContainer.avatar_session_service]
    ),
):
    client = session_service.get_supabase_client()
    result = (
        client.table("chats")
        .delete()
        .eq("id", chat_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=403, detail="Chat not found or access denied")
    return None
