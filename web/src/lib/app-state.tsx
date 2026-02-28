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
import { avatars } from "@/lib/dummy-data";
import {
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

const seedCharacters: Character[] = avatars.map((a) => ({
  id: a.id,
  name: a.name,
  initials: a.initials,
  color: a.color,
}));

interface AppState {
  characters: Character[];
  files: UploadedFile[];
  filesLoading: boolean;
  addCharacter: (name: string) => void;
  deleteCharacter: (id: string) => void;
  addFile: (file: File) => Promise<void>;
  deleteFile: (id: string) => Promise<void>;
  extractKnowledge: (fileId: string, characterNames: string[]) => void;
  loadFiles: () => Promise<void>;
}

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [characters, setCharacters] = useState<Character[]>(seedCharacters);
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
      loadFiles();
    }
  }, [loadFiles]);

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
        files,
        filesLoading,
        addCharacter,
        deleteCharacter,
        addFile,
        deleteFile,
        extractKnowledge,
        loadFiles,
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
