"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import type {
  StoryEntity,
  ChatSummary,
  UploadedFile,
  ExtractionProgress,
} from "@/types";
import type { StoryEntityType } from "@/lib/story-entities/registry";
import {
  listStoryEntities,
  listChats as apiListChats,
  createStoryEntity as apiCreateStoryEntity,
  DuplicateStoryEntityError,
  deleteStoryEntity as apiDeleteStoryEntity,
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

export type AddStoryEntityResult =
  | { ok: true }
  | { ok: false; reason: "duplicate" | "error"; message: string };

interface AppState {
  entities: StoryEntity[];
  entitiesLoading: boolean;
  characters: StoryEntity[];
  locations: StoryEntity[];
  chats: ChatSummary[];
  chatsLoading: boolean;
  files: UploadedFile[];
  filesLoading: boolean;
  addStoryEntity: (type: StoryEntityType, name: string) => Promise<AddStoryEntityResult>;
  deleteStoryEntity: (id: string) => Promise<void>;
  addFile: (file: File) => Promise<void>;
  deleteFile: (id: string) => Promise<void>;
  extractKnowledge: (
    fileId: string,
    selectedEntities: Record<string, string[]>,
    selectedEntityIds: string[],
  ) => void;
  loadFiles: () => Promise<void>;
  loadEntities: () => Promise<void>;
  loadChats: () => Promise<void>;
}

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [entities, setEntities] = useState<StoryEntity[]>([]);
  const [entitiesLoading, setEntitiesLoading] = useState(false);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const loadedRef = useRef(false);

  const characters = useMemo(
    () => entities.filter((e) => e.entityType === "character"),
    [entities]
  );
  const locations = useMemo(
    () => entities.filter((e) => e.entityType === "location"),
    [entities]
  );

  const updateFile = useCallback(
    (fileId: string, patch: Partial<UploadedFile>) => {
      setFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, ...patch } : f))
      );
    },
    []
  );

  const loadEntities = useCallback(async () => {
    setEntitiesLoading(true);
    try {
      const [chars, locs] = await Promise.all([
        listStoryEntities("character"),
        listStoryEntities("location"),
      ]);
      const toEntity = (
        r: { id: string; entity_type: StoryEntityType; name: string; initials: string; color: string }
      ): StoryEntity => ({
        id: r.id,
        entityType: r.entity_type,
        name: r.name,
        initials: r.initials,
        color: r.color,
      });
      setEntities([...chars.map(toEntity), ...locs.map(toEntity)]);
    } catch {
      // Backend not available — keep local state
    } finally {
      setEntitiesLoading(false);
    }
  }, []);

  const loadChats = useCallback(async () => {
    setChatsLoading(true);
    try {
      const data = await apiListChats();
      setChats(data);
    } catch {
      // Backend not available — keep local state
    } finally {
      setChatsLoading(false);
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
          extractedEntityIds: d.extracted_entity_ids ?? [],
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
      loadEntities();
      loadChats();
      loadFiles();
    }
  }, [loadEntities, loadChats, loadFiles]);

  const addStoryEntity = useCallback(
    async (
      entityType: StoryEntityType,
      name: string
    ): Promise<AddStoryEntityResult> => {
      const trimmed = name.trim();
      if (!trimmed)
        return { ok: false, reason: "error", message: "Name is required" };

      const existing = entities.filter((e) => e.entityType === entityType);
      const duplicate = existing.find(
        (e) => e.name.toLowerCase() === trimmed.toLowerCase()
      );
      if (duplicate) {
        return {
          ok: false,
          reason: "duplicate",
          message: `"${duplicate.name}" already exists`,
        };
      }

      const initials = generateInitials(trimmed);
      const color = pickColor(existing.length);
      try {
        const created = await apiCreateStoryEntity(
          entityType,
          trimmed,
          initials,
          color
        );
        setEntities((prev) => [
          ...prev,
          {
            id: created.id,
            entityType: created.entity_type,
            name: created.name,
            initials: created.initials,
            color: created.color,
          },
        ]);
        return { ok: true };
      } catch (err) {
        if (err instanceof DuplicateStoryEntityError) {
          return { ok: false, reason: "duplicate", message: err.message };
        }
        return {
          ok: false,
          reason: "error",
          message: `Failed to create ${entityType}`,
        };
      }
    },
    [entities]
  );

  const deleteStoryEntity = useCallback(async (id: string) => {
    setEntities((prev) => prev.filter((e) => e.id !== id));
    try {
      await apiDeleteStoryEntity(id);
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
      extractedEntityIds: [],
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
    (
      fileId: string,
      selectedEntities: Record<string, string[]>,
      selectedEntityIds: string[],
    ) => {
      const allNames = Object.values(selectedEntities).flat();
      updateFile(fileId, {
        status: "extracting",
        extractionProgress: { stage: "starting", progressPct: 0 },
        extractionEntities: allNames,
      });

      streamExtractKnowledge(
        fileId,
        selectedEntities,
        selectedEntityIds,
        "advanced",
        {
          onProgress: (e: ExtractionProgress) => {
            updateFile(fileId, { extractionProgress: e });
          },
          onComplete: (e) => {
            updateFile(fileId, {
              status: "extracted",
              knowledgeExtracted: true,
              chunksStored: e.chunks_stored,
              extractedEntityIds: e.extracted_entity_ids ?? selectedEntityIds,
              extractionProgress: undefined,
            });
          },
          onError: (msg) => {
            console.error(`[extraction] failed for ${fileId}:`, msg);
            updateFile(fileId, {
              status: "error",
              errorMessage: msg,
              extractionProgress: undefined,
            });
          },
        }
      );
    },
    [updateFile]
  );

  return (
    <AppStateContext.Provider
      value={{
        entities,
        entitiesLoading,
        characters,
        locations,
        chats,
        chatsLoading,
        files,
        filesLoading,
        addStoryEntity,
        deleteStoryEntity,
        addFile,
        deleteFile,
        extractKnowledge,
        loadFiles,
        loadEntities,
        loadChats,
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
