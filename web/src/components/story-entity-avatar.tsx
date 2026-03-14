import { cn } from "@/lib/utils";
import type { StoryEntityType } from "@/lib/story-entities/registry";
import { STORY_ENTITY_REGISTRY } from "@/lib/story-entities/registry";

const WRAPPER_SIZE = {
  sm: "h-5 w-5",
  md: "h-8 w-8",
  lg: "h-9 w-9",
} as const;

const TEXT_SIZE = {
  sm: "text-[8px]",
  md: "text-xs",
  lg: "text-sm",
} as const;

const BADGE_CLASSES = {
  sm: "h-2.5 w-2.5 -bottom-[3px] -right-[3px]",
  md: "h-3.5 w-3.5 -bottom-[4px] -right-[4px]",
  lg: "h-4 w-4 -bottom-[4px] -right-[4px]",
} as const;

const BADGE_ICON_SIZE = {
  sm: "h-1.5 w-1.5",
  md: "h-2 w-2",
  lg: "h-2.5 w-2.5",
} as const;

interface StoryEntityAvatarProps {
  initials: string;
  color: string;
  entityType: StoryEntityType;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function StoryEntityAvatar({
  initials,
  color,
  entityType,
  size = "md",
  className,
}: StoryEntityAvatarProps) {
  const BadgeIcon = STORY_ENTITY_REGISTRY[entityType].icon;

  return (
    <div className={cn("relative shrink-0", WRAPPER_SIZE[size], className)}>
      <div
        className={cn(
          "absolute inset-0 rounded-md flex items-center justify-center font-medium text-white",
          TEXT_SIZE[size]
        )}
        style={{ backgroundColor: color }}
      >
        {initials}
      </div>
      <div
        className={cn(
          "absolute rounded-full bg-background border border-border flex items-center justify-center",
          BADGE_CLASSES[size]
        )}
      >
        <BadgeIcon className={cn("text-muted-foreground", BADGE_ICON_SIZE[size])} />
      </div>
    </div>
  );
}
