from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.story_entities.registry import STORY_ENTITY_REGISTRY, get_entity_config

if TYPE_CHECKING:
    from supabase import Client

logger = logging.getLogger(__name__)

TABLE = "story_entities"


class DuplicateStoryEntityError(Exception):
    def __init__(self, entity_type: str, name: str) -> None:
        config = STORY_ENTITY_REGISTRY[entity_type]
        super().__init__(f'A {config.display_name.lower()} named "{name}" already exists')


class StoryEntityService:
    """Generic CRUD for the ``story_entities`` table, filtered by entity type."""

    def __init__(self, client: Client) -> None:
        self._client = client

    def list(self, user_id: str, entity_type: str) -> list[dict]:
        get_entity_config(entity_type)
        result = (
            self._client.table(TABLE)
            .select("id, entity_type, name, initials, color, created_at")
            .eq("user_id", user_id)
            .eq("entity_type", entity_type)
            .order("created_at", desc=False)
            .execute()
        )
        return result.data

    def create(
        self,
        user_id: str,
        entity_type: str,
        name: str,
        initials: str,
        color: str,
    ) -> dict:
        get_entity_config(entity_type)

        existing = (
            self._client.table(TABLE)
            .select("id")
            .eq("user_id", user_id)
            .eq("entity_type", entity_type)
            .ilike("name", name)
            .limit(1)
            .execute()
        )
        if existing.data:
            raise DuplicateStoryEntityError(entity_type, name)

        result = (
            self._client.table(TABLE)
            .insert(
                {
                    "user_id": user_id,
                    "entity_type": entity_type,
                    "name": name,
                    "initials": initials,
                    "color": color,
                }
            )
            .execute()
        )
        return result.data[0]

    def delete(self, user_id: str, entity_id: str) -> bool:
        result = (
            self._client.table(TABLE)
            .delete()
            .eq("id", entity_id)
            .eq("user_id", user_id)
            .execute()
        )
        return bool(result.data)
