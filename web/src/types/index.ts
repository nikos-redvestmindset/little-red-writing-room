export interface Avatar {
  id: string;
  name: string;
  description: string;
  initials: string;
  color: string;
}

export interface Character {
  id: string;
  name: string;
  initials: string;
  color: string;
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
  knowledgeExtracted: boolean;
  extractionEntities: string[];
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

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}
