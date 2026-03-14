from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class StoryEntityTypeConfig:
    key: str
    display_name: str
    display_plural: str
    table: str = "story_entities"


STORY_ENTITY_REGISTRY: dict[str, StoryEntityTypeConfig] = {
    "character": StoryEntityTypeConfig(
        key="character",
        display_name="Character",
        display_plural="Characters",
    ),
    "location": StoryEntityTypeConfig(
        key="location",
        display_name="Location",
        display_plural="Locations",
    ),
}


def get_entity_config(entity_type: str) -> StoryEntityTypeConfig:
    config = STORY_ENTITY_REGISTRY.get(entity_type)
    if config is None:
        valid = ", ".join(sorted(STORY_ENTITY_REGISTRY))
        raise ValueError(f"Unknown entity type {entity_type!r}. Valid types: {valid}")
    return config
