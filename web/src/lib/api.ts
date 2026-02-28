import { createClient } from "@/lib/supabase/client";
import type {
  ChatStreamRequest,
  SSETokenEvent,
  SSECitationEvent,
  SSEGapEvent,
  SSEDoneEvent,
} from "@/types/chat";
import type { ExtractionProgress } from "@/types";

function apiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "";
}

async function getBearerToken(): Promise<string> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  return session.access_token;
}

export async function createChat(
  chatId: string,
  characterId: string,
  title?: string
): Promise<void> {
  const token = await getBearerToken();
  const res = await fetch(`${apiUrl()}/chats`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      chat_id: chatId,
      character_id: characterId,
      title,
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to create chat: HTTP ${res.status}`);
  }
}

export async function listChats(): Promise<
  {
    id: string;
    character_id: string;
    title: string | null;
    created_at: string;
    updated_at: string;
  }[]
> {
  const token = await getBearerToken();
  const res = await fetch(`${apiUrl()}/chats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to list chats: HTTP ${res.status}`);
  return res.json();
}

export async function streamCharacterChat(
  req: ChatStreamRequest,
  handlers: {
    onToken: (e: SSETokenEvent) => void;
    onCitation: (e: SSECitationEvent) => void;
    onGap: (e: SSEGapEvent) => void;
    onDone: (e: SSEDoneEvent) => void;
    onError: (err: string) => void;
  }
): Promise<void> {
  const token = await getBearerToken();

  const res = await fetch(`${apiUrl()}/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    handlers.onError(`HTTP ${res.status}`);
    return;
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const eventLine = frame.match(/^event: (.+)$/m)?.[1];
      const dataLine = frame.match(/^data: (.+)$/m)?.[1];
      if (!dataLine) continue;

      const payload = JSON.parse(dataLine);
      if (eventLine === "token") handlers.onToken(payload);
      if (eventLine === "citation") handlers.onCitation(payload);
      if (eventLine === "gap") handlers.onGap(payload);
      if (eventLine === "done") handlers.onDone(payload);
      if (eventLine === "error") handlers.onError(payload.message);
    }
  }
}

// ── Character APIs ────────────────────────────────────────────────────────────

export interface CharacterResponse {
  id: string;
  name: string;
  initials: string;
  color: string;
  created_at: string;
}

export async function listCharacters(): Promise<CharacterResponse[]> {
  const token = await getBearerToken();
  const res = await fetch(`${apiUrl()}/characters`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to list characters: HTTP ${res.status}`);
  return res.json();
}

export async function createCharacter(
  name: string,
  initials: string,
  color: string
): Promise<CharacterResponse> {
  const token = await getBearerToken();
  const res = await fetch(`${apiUrl()}/characters`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name, initials, color }),
  });
  if (!res.ok) {
    throw new Error(`Failed to create character: HTTP ${res.status}`);
  }
  return res.json();
}

export async function deleteCharacterApi(characterId: string): Promise<void> {
  const token = await getBearerToken();
  const res = await fetch(`${apiUrl()}/characters/${characterId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok)
    throw new Error(`Failed to delete character: HTTP ${res.status}`);
}

// ── Document APIs ─────────────────────────────────────────────────────────────

export interface DocumentResponse {
  id: string;
  filename: string;
  size: number;
  status: string;
  uploaded_at: string;
  chunks_stored?: number;
  error_message?: string;
}

export async function uploadDocument(file: File): Promise<DocumentResponse> {
  const token = await getBearerToken();
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${apiUrl()}/documents/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed: HTTP ${res.status} — ${text}`);
  }
  return res.json();
}

export async function listDocuments(): Promise<DocumentResponse[]> {
  const token = await getBearerToken();
  const res = await fetch(`${apiUrl()}/documents`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to list documents: HTTP ${res.status}`);
  return res.json();
}

export async function deleteDocument(docId: string): Promise<void> {
  const token = await getBearerToken();
  const res = await fetch(`${apiUrl()}/documents/${docId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to delete document: HTTP ${res.status}`);
}

export async function streamExtractKnowledge(
  docId: string,
  selectedCharacters: string[],
  pipelineOption: string,
  handlers: {
    onProgress: (e: ExtractionProgress) => void;
    onComplete: (e: { chunks_stored: number }) => void;
    onError: (msg: string) => void;
  }
): Promise<void> {
  const token = await getBearerToken();

  const res = await fetch(`${apiUrl()}/documents/${docId}/extract`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      selected_characters: selectedCharacters,
      pipeline_option: pipelineOption,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    handlers.onError(`HTTP ${res.status} — ${text}`);
    return;
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const eventLine = frame.match(/^event: (.+)$/m)?.[1];
      const dataLine = frame.match(/^data: (.+)$/m)?.[1];
      if (!dataLine) continue;

      const payload = JSON.parse(dataLine);
      if (eventLine === "progress") {
        handlers.onProgress({
          stage: payload.stage,
          progressPct: payload.progress_pct,
          chunksTotal: payload.chunks_total,
          chunksProcessed: payload.chunks_processed,
        });
      }
      if (eventLine === "complete") handlers.onComplete(payload);
      if (eventLine === "error") handlers.onError(payload.message);
    }
  }
}
