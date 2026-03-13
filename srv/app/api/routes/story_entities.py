import logging

from dependency_injector.wiring import Provide, inject
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.api.deps import get_current_user_id
from app.containers import ApplicationContainer
from app.story_entities.registry import STORY_ENTITY_REGISTRY
from app.story_entities.service import DuplicateStoryEntityError, StoryEntityService

logger = logging.getLogger(__name__)

router = APIRouter()


class StoryEntityCreate(BaseModel):
    entity_type: str
    name: str
    initials: str
    color: str


@router.get("")
@inject
async def list_story_entities(
    user_id: str = Depends(get_current_user_id),
    entity_type: str = Query(..., alias="type"),
    service: StoryEntityService = Depends(
        Provide[ApplicationContainer.story_entity_service]
    ),
) -> list[dict]:
    if entity_type not in STORY_ENTITY_REGISTRY:
        raise HTTPException(status_code=400, detail=f"Unknown entity type: {entity_type}")
    return service.list(user_id, entity_type)


@router.post("", status_code=201)
@inject
async def create_story_entity(
    body: StoryEntityCreate,
    user_id: str = Depends(get_current_user_id),
    service: StoryEntityService = Depends(
        Provide[ApplicationContainer.story_entity_service]
    ),
) -> dict:
    if body.entity_type not in STORY_ENTITY_REGISTRY:
        raise HTTPException(status_code=400, detail=f"Unknown entity type: {body.entity_type}")
    try:
        return service.create(user_id, body.entity_type, body.name, body.initials, body.color)
    except DuplicateStoryEntityError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.delete("/{entity_id}", status_code=204)
@inject
async def delete_story_entity(
    entity_id: str,
    user_id: str = Depends(get_current_user_id),
    service: StoryEntityService = Depends(
        Provide[ApplicationContainer.story_entity_service]
    ),
):
    deleted = service.delete(user_id, entity_id)
    if not deleted:
        raise HTTPException(status_code=403, detail="Entity not found or access denied")
    return None
