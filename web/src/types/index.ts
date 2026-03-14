export interface Avatar {
  id: string;
  name: string;
  description: string;
  initials: string;
  color: string;
}

import type { StoryEntityType } from "@/lib/story-entities/registry";

export interface StoryEntity {
  id: string;
  entityType: StoryEntityType;
  name: string;
  initials: string;
  color: string;
}

/** @deprecated Use StoryEntity instead */
export type Character = StoryEntity;
/** @deprecated Use StoryEntity instead */
export type Location = StoryEntity;

export interface ExtractionProgress {
  stage: string;
  progressPct: number;
  chunksTotal?: number;
  chunksProcessed?: number;
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
  status: "uploading" | "uploaded" | "extracting" | "extracted" | "error";
  knowledgeExtracted: boolean;
  extractionEntities: string[];
  extractedEntityIds: string[];
  chunksStored?: number;
  extractionProgress?: ExtractionProgress;
  errorMessage?: string;
}

export interface GapFlag {
  attribute: string;
  suggestion: string;
}

export interface Message {
  id: string;
  threadId: string;
  role: "user" | "assistant";
  content: string;
  avatarId?: string;
  citations?: Citation[];
  gapFlags?: GapFlag[];
  createdAt: string;
}

export interface Citation {
  sourceDocument: string;
  quote: string;
}

export interface Thread {
  id: string;
  title: string;
  avatarId: string;
  lastMessageAt: string;
  preview: string;
}

export interface ChatSummary {
  id: string;
  character_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}
