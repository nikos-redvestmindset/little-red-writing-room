"use client";

import { avatars } from "@/lib/dummy-data";
import type { Avatar } from "@/types";
import { cn } from "@/lib/utils";

interface AvatarSelectorProps {
  selectedId: string | null;
  onSelect: (avatar: Avatar) => void;
}

export function AvatarSelector({ selectedId, onSelect }: AvatarSelectorProps) {
  return (
    <div className="flex flex-col items-center gap-8 py-12 px-4">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-light tracking-tight">
          Who would you like to talk to?
        </h2>
        <p className="text-sm text-muted-foreground">
          Select a character from your story
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 w-full max-w-md">
        {avatars.map((avatar) => (
          <button
            key={avatar.id}
            onClick={() => onSelect(avatar)}
            className={cn(
              "flex flex-col items-start gap-2 p-4 text-left transition-colors border",
              "hover:bg-accent",
              selectedId === avatar.id
                ? "border-primary bg-accent"
                : "border-border"
            )}
          >
            <div className="flex items-center gap-2">
              <div
                className="h-8 w-8 rounded-sm flex items-center justify-center text-xs font-medium text-white"
                style={{ backgroundColor: avatar.color }}
              >
                {avatar.initials}
              </div>
              <span className="font-medium text-sm">{avatar.name}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {avatar.description}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
