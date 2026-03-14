"use client";

import { useRef, useState, useMemo } from "react";
import {
  Upload,
  Trash2,
  FileText,
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { useAppState } from "@/lib/app-state";
import { STORY_ENTITY_TYPES } from "@/lib/story-entities/registry";
import type { StoryEntityType } from "@/lib/story-entities/registry";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { StoryEntityAvatar } from "@/components/story-entity-avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { UploadedFile } from "@/types";

const STAGE_LABELS: Record<string, string> = {
  starting: "Starting...",
  chunking: "Splitting into chunks...",
  classifying: "Classifying chunks...",
  embedding: "Embedding & storing...",
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileStatusBadge({ file }: { file: UploadedFile }) {
  if (file.status === "uploading") {
    return (
      <Badge
        variant="secondary"
        className="text-[10px] h-5 px-2 shrink-0 gap-1"
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        Uploading
      </Badge>
    );
  }
  if (file.status === "extracted") {
    return (
      <Badge
        variant="secondary"
        className="text-[10px] h-5 px-2 shrink-0 gap-1"
      >
        <CheckCircle2 className="h-3 w-3" />
        {file.chunksStored ? `${file.chunksStored} chunks` : "Extracted"}
      </Badge>
    );
  }
  if (file.status === "error") {
    return (
      <Badge
        variant="destructive"
        className="text-[10px] h-5 px-2 shrink-0 gap-1"
      >
        <AlertCircle className="h-3 w-3" />
        Error
      </Badge>
    );
  }
  return null;
}

function ExtractionCoverageBadges({ file }: { file: UploadedFile }) {
  const { entities } = useAppState();
  if (file.status !== "extracted") return null;

  const badges = STORY_ENTITY_TYPES.map((config) => {
    const total = entities.filter((e) => e.entityType === config.key);
    if (total.length === 0) return null;
    const extracted = total.filter((e) =>
      file.extractedEntityIds.includes(e.id)
    );
    const isComplete = extracted.length === total.length;
    const tooltip = isComplete
      ? `All ${config.plural.toLowerCase()} were included in the last extraction.`
      : `${total.length - extracted.length} of ${total.length} ${config.plural.toLowerCase()} have not been extracted from this document yet.`;
    return (
      <Tooltip key={config.key}>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`text-[10px] h-5 px-2 shrink-0 cursor-default ${
              isComplete
                ? "text-muted-foreground border-border"
                : "text-amber-600 border-amber-300"
            }`}
          >
            {extracted.length}/{total.length} {config.plural.toLowerCase()}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs max-w-56">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    );
  }).filter(Boolean);

  if (badges.length === 0) return null;
  return <>{badges}</>;
}

function ExtractionProgress({ file }: { file: UploadedFile }) {
  const progress = file.extractionProgress;
  if (file.status !== "extracting" || !progress) return null;

  const label = STAGE_LABELS[progress.stage] ?? progress.stage;
  const detail =
    progress.chunksTotal && progress.chunksProcessed
      ? ` (${progress.chunksProcessed}/${progress.chunksTotal})`
      : "";

  return (
    <div className="flex-1 min-w-0 space-y-1">
      <div className="flex items-center gap-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
        <span className="text-xs text-muted-foreground truncate">
          {label}
          {detail}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${progress.progressPct}%` }}
        />
      </div>
    </div>
  );
}

export default function ContentPage() {
  const { files, filesLoading, addFile, deleteFile } = useAppState();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [extractDialogFileId, setExtractDialogFileId] = useState<string | null>(
    null
  );

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files;
    if (!selected?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(selected)) {
        await addFile(f);
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-light tracking-tight">Content</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload and manage your story files
          </p>
        </div>
        <div>
          <input
            id="file-upload"
            name="file-upload"
            ref={fileInputRef}
            type="file"
            multiple
            accept=".md,.docx,.txt"
            onChange={handleFileChange}
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="gap-2 rounded-md"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploading ? "Uploading..." : "Upload files"}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="max-w-2xl mx-auto px-6 py-6">
          {filesLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading files...</span>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100svh-220px)]">
              <div className="space-y-2">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 px-4 py-3 rounded-md border border-border hover:bg-accent/50 transition-colors group"
                  >
                    <FileText className="h-5 w-5 text-muted-foreground shrink-0" />

                    {file.status === "extracting" ? (
                      <div className="flex-1 min-w-0 space-y-1">
                        <span className="text-sm font-medium truncate block">
                          {file.name}
                        </span>
                        <ExtractionProgress file={file} />
                      </div>
                    ) : (
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">
                            {file.name}
                          </span>
                          <FileStatusBadge file={file} />
                          <ExtractionCoverageBadges file={file} />
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-muted-foreground">
                            {formatSize(file.size)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(file.uploadedAt).toLocaleDateString()}
                          </span>
                          {file.status === "error" && file.errorMessage && (
                            <span className="text-xs text-destructive truncate">
                              {file.errorMessage}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-1">
                      {(file.status === "uploaded" ||
                        file.status === "error") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExtractDialogFileId(file.id)}
                          className="h-8 gap-1.5 text-xs rounded-md"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          {file.status === "error" ? "Retry" : "Extract"}
                        </Button>
                      )}
                      {file.status === "extracted" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExtractDialogFileId(file.id)}
                          className="h-8 gap-1.5 text-xs rounded-md"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Update
                        </Button>
                      )}
                      {file.status !== "extracting" &&
                        file.status !== "uploading" && (
                          <button
                            onClick={() => deleteFile(file.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                    </div>
                  </div>
                ))}
                {files.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm italic">No files uploaded</p>
                    <p className="text-xs mt-1">
                      Upload .md, .docx, or .txt files to get started
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>

      {extractDialogFileId && (
        <ExtractKnowledgeDialog
          fileId={extractDialogFileId}
          onClose={() => setExtractDialogFileId(null)}
        />
      )}
    </div>
  );
}

function ExtractKnowledgeDialog({
  fileId,
  onClose,
}: {
  fileId: string;
  onClose: () => void;
}) {
  const { entities, files, extractKnowledge } = useAppState();
  const file = files.find((f) => f.id === fileId);
  const isReExtraction = file?.status === "extracted";

  const [selectedByType, setSelectedByType] = useState<
    Record<string, Set<string>>
  >(() => {
    const initial: Record<string, Set<string>> = {};
    for (const cfg of STORY_ENTITY_TYPES) {
      if (isReExtraction) {
        const previouslyExtracted = entities
          .filter(
            (e) =>
              e.entityType === cfg.key &&
              file?.extractedEntityIds.includes(e.id)
          )
          .map((e) => e.name);
        initial[cfg.key] = new Set(previouslyExtracted);
      } else {
        initial[cfg.key] = new Set<string>();
      }
    }
    return initial;
  });

  const entitiesByType = useMemo(() => {
    const grouped: Record<StoryEntityType, typeof entities> = {} as Record<
      StoryEntityType,
      typeof entities
    >;
    for (const cfg of STORY_ENTITY_TYPES) {
      grouped[cfg.key] = entities.filter((e) => e.entityType === cfg.key);
    }
    return grouped;
  }, [entities]);

  function toggleAll(entityType: string) {
    setSelectedByType((prev) => {
      const typeEntities = entitiesByType[entityType as StoryEntityType] ?? [];
      const allSelected = typeEntities.length > 0 && prev[entityType]?.size === typeEntities.length;
      return {
        ...prev,
        [entityType]: allSelected
          ? new Set<string>()
          : new Set(typeEntities.map((e) => e.name)),
      };
    });
  }

  function toggleEntity(entityType: string, name: string) {
    setSelectedByType((prev) => {
      const next = new Set(prev[entityType]);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return { ...prev, [entityType]: next };
    });
  }

  function handleRun() {
    const selectedEntities: Record<string, string[]> = {};
    const selectedEntityIds: string[] = [];

    for (const cfg of STORY_ENTITY_TYPES) {
      const names = Array.from(selectedByType[cfg.key] ?? []);
      selectedEntities[cfg.key] = names;

      const typeEntities = entitiesByType[cfg.key] ?? [];
      for (const name of names) {
        const entity = typeEntities.find((e) => e.name === name);
        if (entity) selectedEntityIds.push(entity.id);
      }
    }

    extractKnowledge(fileId, selectedEntities, selectedEntityIds);
    onClose();
  }

  if (!file) return null;

  const hasSelection = Object.values(selectedByType).some((s) => s.size > 0);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-lg">
        <DialogHeader>
          <DialogTitle className="text-base">
            {isReExtraction ? "Update Extraction" : "Extract Knowledge"}
          </DialogTitle>
          <DialogDescription>
            Select entities to extract knowledge about from{" "}
            <span className="font-medium text-foreground">{file.name}</span>.
            {isReExtraction && (
              <span className="block mt-1 text-xs text-amber-600">
                Previously extracted entities are pre-selected. This will
                re-process all selected entities.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {STORY_ENTITY_TYPES.map((config, sectionIdx) => {
            const typeEntities = entitiesByType[config.key] ?? [];
            const selected = selectedByType[config.key] ?? new Set();
            const allSelected =
              typeEntities.length > 0 && selected.size === typeEntities.length;

            return (
              <div key={config.key}>
                {sectionIdx > 0 && <Separator className="mb-3" />}

                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
                  {config.plural}
                </span>

                {typeEntities.length > 0 && (
                  <label className="flex items-center gap-2.5 px-1 mt-2 cursor-pointer">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={() => toggleAll(config.key)}
                    />
                    <span className="text-sm font-medium">Select all</span>
                  </label>
                )}

                <div className="space-y-1 max-h-32 overflow-y-auto mt-1">
                  {typeEntities.map((entity) => {
                    const wasExtracted =
                      isReExtraction &&
                      file.extractedEntityIds.includes(entity.id);
                    return (
                      <label
                        key={entity.id}
                        className="flex items-center gap-2.5 px-1 py-1 rounded-md hover:bg-accent cursor-pointer"
                      >
                        <Checkbox
                          checked={selected.has(entity.name)}
                          onCheckedChange={() =>
                            toggleEntity(config.key, entity.name)
                          }
                        />
                        <StoryEntityAvatar
                          initials={entity.initials}
                          color={entity.color}
                          entityType={config.key}
                          size="sm"
                        />
                        <span className="text-sm">{entity.name}</span>
                        {wasExtracted && (
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            extracted
                          </span>
                        )}
                        {isReExtraction && !wasExtracted && (
                          <span className="text-[10px] text-amber-600 ml-auto">
                            new
                          </span>
                        )}
                      </label>
                    );
                  })}
                  {typeEntities.length === 0 && (
                    <p className="text-sm text-muted-foreground px-1">
                      No {config.plural.toLowerCase()} defined.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-md">
            Cancel
          </Button>
          <Button
            onClick={handleRun}
            disabled={!hasSelection}
            className="rounded-md"
          >
            <Sparkles className="h-4 w-4 mr-1.5" />
            {isReExtraction ? "Update extraction" : "Run extraction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
