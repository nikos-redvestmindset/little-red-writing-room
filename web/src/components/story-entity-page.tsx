"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAppState } from "@/lib/app-state";
import type { StoryEntityType } from "@/lib/story-entities/registry";
import { STORY_ENTITY_REGISTRY } from "@/lib/story-entities/registry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StoryEntityAvatar } from "@/components/story-entity-avatar";

interface StoryEntityPageProps {
  entityType: StoryEntityType;
}

export function StoryEntityPage({ entityType }: StoryEntityPageProps) {
  const config = STORY_ENTITY_REGISTRY[entityType];
  const { entities, addStoryEntity, deleteStoryEntity, loadEntities } =
    useAppState();
  const [newName, setNewName] = useState("");

  const items = entities.filter((e) => e.entityType === entityType);

  useEffect(() => {
    loadEntities();
  }, [loadEntities]);

  async function handleAdd() {
    if (!newName.trim()) return;
    const result = await addStoryEntity(entityType, newName);
    if (result.ok) {
      setNewName("");
    } else if (result.reason === "duplicate") {
      toast.warning(result.message);
    } else {
      toast.error(result.message);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4">
        <h1 className="text-xl font-light tracking-tight">{config.plural}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage the {config.plural.toLowerCase()} in your story
        </p>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="max-w-2xl mx-auto px-6 py-6 space-y-6">
          <div className="flex gap-2">
            <Input
              id={`new-${entityType}-name`}
              name={`new-${entityType}-name`}
              autoComplete="off"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder={config.placeholder}
              className="h-10 rounded-md"
            />
            <Button onClick={handleAdd} className="h-10 gap-2 rounded-md">
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>

          <ScrollArea className="h-[calc(100svh-220px)]">
            <div className="space-y-2">
              {items.map((entity) => (
                <div
                  key={entity.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-md border border-border hover:bg-accent/50 transition-colors group"
                >
                  <StoryEntityAvatar
                    initials={entity.initials}
                    color={entity.color}
                    entityType={entityType}
                    size="lg"
                  />
                  <span className="text-sm font-medium flex-1">
                    {entity.name}
                  </span>
                  <button
                    onClick={() => deleteStoryEntity(entity.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {items.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-sm italic">
                    No {config.plural.toLowerCase()} yet
                  </p>
                  <p className="text-xs mt-1">
                    Add a {config.label.toLowerCase()} above to get started
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
