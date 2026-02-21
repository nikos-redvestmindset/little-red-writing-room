export interface Avatar {
  id: string;
  name: string;
  description: string;
  initials: string;
  color: string;
}

export interface Message {
  id: string;
  threadId: string;
  role: "user" | "assistant";
  content: string;
  avatarId?: string;
  citations?: Citation[];
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
