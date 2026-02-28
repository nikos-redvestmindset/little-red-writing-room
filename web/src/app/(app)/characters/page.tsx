"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useAppState } from "@/lib/app-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function CharactersPage() {
  const { characters, addCharacter, deleteCharacter } = useAppState();
  const [newName, setNewName] = useState("");

  async function handleAdd() {
    if (!newName.trim()) return;
    await addCharacter(newName);
    setNewName("");
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4">
        <h1 className="text-xl font-light tracking-tight">Characters</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage the characters in your story
        </p>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="max-w-2xl mx-auto px-6 py-6 space-y-6">
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="Character name…"
              className="h-10 rounded-md"
            />
            <Button onClick={handleAdd} className="h-10 gap-2 rounded-md">
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>

          <ScrollArea className="h-[calc(100svh-220px)]">
            <div className="space-y-2">
              {characters.map((char) => (
                <div
                  key={char.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-md border border-border hover:bg-accent/50 transition-colors group"
                >
                  <div
                    className="h-9 w-9 shrink-0 rounded-md flex items-center justify-center text-sm font-medium text-white"
                    style={{ backgroundColor: char.color }}
                  >
                    {char.initials}
                  </div>
                  <span className="text-sm font-medium flex-1">
                    {char.name}
                  </span>
                  <button
                    onClick={() => deleteCharacter(char.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {characters.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-sm italic">No characters yet</p>
                  <p className="text-xs mt-1">
                    Add a character above to get started
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
