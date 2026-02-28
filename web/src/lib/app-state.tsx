"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import type { Character, UploadedFile, ExtractionProgress } from "@/types";
import {
  listCharacters as apiListCharacters,
  createCharacter as apiCreateCharacter,
  deleteCharacterApi,
  uploadDocument,
  listDocuments,
  deleteDocument,
  streamExtractKnowledge,
} from "@/lib/api";

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

interface AppState {
  characters: Character[];
  charactersLoading: boolean;
  files: UploadedFile[];
  filesLoading: boolean;
  addCharacter: (name: string) => Promise<void>;
  deleteCharacter: (id: string) => Promise<void>;
  addFile: (file: File) => Promise<void>;
  deleteFile: (id: string) => Promise<void>;
  extractKnowledge: (fileId: string, characterNames: string[]) => void;
  loadFiles: () => Promise<void>;
  loadCharacters: () => Promise<void>;
}

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [charactersLoading, setCharactersLoading] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const loadedRef = useRef(false);

  const updateFile = useCallback(
    (fileId: string, patch: Partial<UploadedFile>) => {
      setFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, ...patch } : f))
      );
    },
    []
  );

  const loadCharacters = useCallback(async () => {
    setCharactersLoading(true);
    try {
      const chars = await apiListCharacters();
      setCharacters(
        chars.map((c) => ({
          id: c.id,
          name: c.name,
          initials: c.initials,
          color: c.color,
        }))
      );
    } catch {
      // Backend not available — keep local state
    } finally {
      setCharactersLoading(false);
    }
  }, []);

  const loadFiles = useCallback(async () => {
    setFilesLoading(true);
    try {
      const docs = await listDocuments();
      setFiles(
        docs.map((d) => ({
          id: d.id,
          name: d.filename,
          size: d.size,
          uploadedAt: d.uploaded_at,
          status: d.status as UploadedFile["status"],
          knowledgeExtracted: d.status === "extracted",
          extractionEntities: [],
          chunksStored: d.chunks_stored,
          errorMessage: d.error_message ?? undefined,
        }))
      );
    } catch {
      // Backend not available — keep local state
    } finally {
      setFilesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      loadCharacters();
      loadFiles();
    }
  }, [loadCharacters, loadFiles]);

  const addCharacter = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const initials = generateInitials(trimmed);
      const color = pickColor(characters.length);
      try {
        const created = await apiCreateCharacter(trimmed, initials, color);
        setCharacters((prev) => [
          ...prev,
          {
            id: created.id,
            name: created.name,
            initials: created.initials,
            color: created.color,
          },
        ]);
      } catch {
        // API failure — don't add locally
      }
    },
    [characters.length]
  );

  const deleteCharacter = useCallback(async (id: string) => {
    setCharacters((prev) => prev.filter((c) => c.id !== id));
    try {
      await deleteCharacterApi(id);
    } catch {
      // Optimistic removal — don't re-add on failure
    }
  }, []);

  const addFile = useCallback(async (file: File) => {
    const placeholder: UploadedFile = {
      id: `uploading-${Date.now()}`,
      name: file.name,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      status: "uploading",
      knowledgeExtracted: false,
      extractionEntities: [],
    };
    setFiles((prev) => [...prev, placeholder]);

    try {
      const doc = await uploadDocument(file);
      setFiles((prev) =>
        prev.map((f) =>
          f.id === placeholder.id
            ? {
                ...f,
                id: doc.id,
                status: "uploaded" as const,
                uploadedAt: doc.uploaded_at,
              }
            : f
        )
      );
    } catch {
      setFiles((prev) => prev.filter((f) => f.id !== placeholder.id));
    }
  }, []);

  const deleteFile = useCallback(async (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    try {
      await deleteDocument(id);
    } catch {
      // Optimistic removal — don't re-add on failure
    }
  }, []);

  const extractKnowledge = useCallback(
    (fileId: string, characterNames: string[]) => {
      updateFile(fileId, {
        status: "extracting",
        extractionProgress: { stage: "starting", progressPct: 0 },
        extractionEntities: characterNames,
      });

      streamExtractKnowledge(fileId, characterNames, "advanced", {
        onProgress: (e: ExtractionProgress) => {
          updateFile(fileId, { extractionProgress: e });
        },
        onComplete: (e) => {
          updateFile(fileId, {
            status: "extracted",
            knowledgeExtracted: true,
            chunksStored: e.chunks_stored,
            extractionProgress: undefined,
          });
        },
        onError: (msg) => {
          updateFile(fileId, {
            status: "error",
            errorMessage: msg,
            extractionProgress: undefined,
          });
        },
      });
    },
    [updateFile]
  );

  return (
    <AppStateContext.Provider
      value={{
        characters,
        charactersLoading,
        files,
        filesLoading,
        addCharacter,
        deleteCharacter,
        addFile,
        deleteFile,
        extractKnowledge,
        loadFiles,
        loadCharacters,
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
