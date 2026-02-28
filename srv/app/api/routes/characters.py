import logging

from dependency_injector.wiring import Provide, inject
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from agents.session.service import AvatarSessionService
from app.api.deps import get_current_user_id
from app.containers import ApplicationContainer

logger = logging.getLogger(__name__)

router = APIRouter()


class CharacterCreate(BaseModel):
    name: str
    initials: str
    color: str


@router.get("/characters")
@inject
async def list_characters(
    user_id: str = Depends(get_current_user_id),
    session_service: AvatarSessionService = Depends(
        Provide[ApplicationContainer.avatar_session_service]
    ),
) -> list[dict]:
    client = session_service.get_supabase_client()
    result = (
        client.table("characters")
        .select("id, name, initials, color, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=False)
        .execute()
    )
    return result.data


@router.post("/characters", status_code=201)
@inject
async def create_character(
    body: CharacterCreate,
    user_id: str = Depends(get_current_user_id),
    session_service: AvatarSessionService = Depends(
        Provide[ApplicationContainer.avatar_session_service]
    ),
) -> dict:
    client = session_service.get_supabase_client()
    result = (
        client.table("characters")
        .insert(
            {
                "user_id": user_id,
                "name": body.name,
                "initials": body.initials,
                "color": body.color,
            }
        )
        .execute()
    )
    return result.data[0]


@router.delete("/characters/{character_id}", status_code=204)
@inject
async def delete_character(
    character_id: str,
    user_id: str = Depends(get_current_user_id),
    session_service: AvatarSessionService = Depends(
        Provide[ApplicationContainer.avatar_session_service]
    ),
):
    client = session_service.get_supabase_client()
    result = (
        client.table("characters")
        .delete()
        .eq("id", character_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=403, detail="Character not found or access denied")
    return None
