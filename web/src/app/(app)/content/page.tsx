"use client";

import { useRef, useState } from "react";
import { Upload, Trash2, FileText, Sparkles } from "lucide-react";
import { useAppState } from "@/lib/app-state";
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

export default function ContentPage() {
  const { files, addFile, deleteFile } = useAppState();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [extractDialogFileId, setExtractDialogFileId] = useState<string | null>(
    null
  );

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files;
    if (!selected?.length) return;
    Array.from(selected).forEach((f) => addFile(f));
    e.target.value = "";
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
            ref={fileInputRef}
            type="file"
            multiple
            accept=".md,.docx,.txt"
            onChange={handleFileChange}
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="gap-2 rounded-md"
          >
            <Upload className="h-4 w-4" />
            Upload files
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="max-w-2xl mx-auto px-6 py-6">
          <ScrollArea className="h-[calc(100svh-220px)]">
            <div className="space-y-2">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-md border border-border hover:bg-accent/50 transition-colors group"
                >
                  <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {file.name}
                      </span>
                      {file.knowledgeExtracted && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] h-5 px-2 shrink-0"
                        >
                          Extracted
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        {formatSize(file.size)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(file.uploadedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!file.knowledgeExtracted && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExtractDialogFileId(file.id)}
                        className="h-8 gap-1.5 text-xs rounded-md"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Extract
                      </Button>
                    )}
                    <button
                      onClick={() => deleteFile(file.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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
  const { characters, files, extractKnowledge } = useAppState();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const file = files.find((f) => f.id === fileId);

  const allSelected =
    characters.length > 0 && selected.size === characters.length;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(characters.map((c) => c.name)));
    }
  }

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function handleRun() {
    extractKnowledge(fileId, Array.from(selected));
    onClose();
  }

  if (!file) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-lg">
        <DialogHeader>
          <DialogTitle className="text-base">Extract Knowledge</DialogTitle>
          <DialogDescription>
            Select characters to extract knowledge about from{" "}
            <span className="font-medium text-foreground">{file.name}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {characters.length > 0 && (
            <label className="flex items-center gap-2.5 px-1 cursor-pointer">
              <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
              <span className="text-sm font-medium">Select all</span>
            </label>
          )}

          <Separator />

          <div className="space-y-1 max-h-48 overflow-y-auto">
            {characters.map((char) => (
              <label
                key={char.id}
                className="flex items-center gap-2.5 px-1 py-1 rounded-md hover:bg-accent cursor-pointer"
              >
                <Checkbox
                  checked={selected.has(char.name)}
                  onCheckedChange={() => toggle(char.name)}
                />
                <div
                  className="h-5 w-5 shrink-0 rounded-md flex items-center justify-center text-[9px] font-medium text-white"
                  style={{ backgroundColor: char.color }}
                >
                  {char.initials}
                </div>
                <span className="text-sm">{char.name}</span>
              </label>
            ))}
            {characters.length === 0 && (
              <p className="text-sm text-muted-foreground px-1">
                No characters defined. Add characters first.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-md">
            Cancel
          </Button>
          <Button
            onClick={handleRun}
            disabled={selected.size === 0}
            className="rounded-md"
          >
            <Sparkles className="h-4 w-4 mr-1.5" />
            Run extraction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
