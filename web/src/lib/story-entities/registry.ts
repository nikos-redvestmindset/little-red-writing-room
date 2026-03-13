import { GiDualityMask } from "react-icons/gi";
import { MdCastle } from "react-icons/md";
import type { ComponentType } from "react";

export type StoryEntityType = "character" | "location";

export interface StoryEntityTypeConfig {
  key: StoryEntityType;
  label: string;
  plural: string;
  icon: ComponentType<{ className?: string }>;
  href: string;
  placeholder: string;
}

export const STORY_ENTITY_REGISTRY: Record<
  StoryEntityType,
  StoryEntityTypeConfig
> = {
  character: {
    key: "character",
    label: "Character",
    plural: "Characters",
    icon: GiDualityMask,
    href: "/characters",
    placeholder: "Character name\u2026",
  },
  location: {
    key: "location",
    label: "Location",
    plural: "Locations",
    icon: MdCastle,
    href: "/locations",
    placeholder: "Location name\u2026",
  },
};

export const STORY_ENTITY_TYPES = Object.values(STORY_ENTITY_REGISTRY);
