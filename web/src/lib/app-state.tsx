"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Character, UploadedFile } from "@/types";
import { avatars } from "@/lib/dummy-data";

const COLOR_PALETTE = [
  "#7C3AED",
  "#64748B",
  "#D97706",
  "#DC2626",
  "#059669",
  "#2563EB",
  "#DB2777",
  "#9333EA",
  "#0891B2",
  "#CA8A04",
];

function generateInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function pickColor(index: number): string {
  return COLOR_PALETTE[index % COLOR_PALETTE.length];
}

const seedCharacters: Character[] = avatars.map((a) => ({
  id: a.id,
  name: a.name,
  initials: a.initials,
  color: a.color,
}));

interface AppState {
  characters: Character[];
  files: UploadedFile[];
  addCharacter: (name: string) => void;
  deleteCharacter: (id: string) => void;
  addFile: (file: File) => void;
  deleteFile: (id: string) => void;
  extractKnowledge: (fileId: string, characterNames: string[]) => void;
}

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [characters, setCharacters] = useState<Character[]>(seedCharacters);
  const [files, setFiles] = useState<UploadedFile[]>([]);

  const addCharacter = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const newChar: Character = {
        id: `char-${Date.now()}`,
        name: trimmed,
        initials: generateInitials(trimmed),
        color: pickColor(characters.length),
      };
      setCharacters((prev) => [...prev, newChar]);
    },
    [characters.length]
  );

  const deleteCharacter = useCallback((id: string) => {
    setCharacters((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const addFile = useCallback((file: File) => {
    const uploaded: UploadedFile = {
      id: `file-${Date.now()}`,
      name: file.name,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      knowledgeExtracted: false,
      extractionEntities: [],
    };
    setFiles((prev) => [...prev, uploaded]);
  }, []);

  const deleteFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const extractKnowledge = useCallback(
    (fileId: string, characterNames: string[]) => {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId
            ? {
                ...f,
                knowledgeExtracted: true,
                extractionEntities: characterNames,
              }
            : f
        )
      );
    },
    []
  );

  return (
    <AppStateContext.Provider
      value={{
        characters,
        files,
        addCharacter,
        deleteCharacter,
        addFile,
        deleteFile,
        extractKnowledge,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error("useAppState must be used within an AppStateProvider");
  }
  return ctx;
}
