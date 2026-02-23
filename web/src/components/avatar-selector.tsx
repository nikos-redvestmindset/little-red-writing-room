"use client";

import { useAppState } from "@/lib/app-state";
import type { Character } from "@/types";
import { cn } from "@/lib/utils";

interface AvatarSelectorProps {
  selectedId: string | null;
  onSelect: (character: Character) => void;
}

export function AvatarSelector({ selectedId, onSelect }: AvatarSelectorProps) {
  const { characters } = useAppState();

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
        {characters.map((character) => (
          <button
            key={character.id}
            onClick={() => onSelect(character)}
            className={cn(
              "flex items-center gap-3 p-4 text-left transition-colors border rounded-md",
              "hover:bg-accent",
              selectedId === character.id
                ? "border-primary bg-accent"
                : "border-border"
            )}
          >
            <div
              className="h-8 w-8 shrink-0 rounded-md flex items-center justify-center text-xs font-medium text-white"
              style={{ backgroundColor: character.color }}
            >
              {character.initials}
            </div>
            <span className="font-medium text-sm">{character.name}</span>
          </button>
        ))}
        {characters.length === 0 && (
          <p className="col-span-2 text-center text-sm text-muted-foreground">
            No characters yet. Add characters from the sidebar.
          </p>
        )}
      </div>
    </div>
  );
}
