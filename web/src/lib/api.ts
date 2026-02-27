import { createClient } from "@/lib/supabase/client";
import type {
  ChatStreamRequest,
  SSETokenEvent,
  SSECitationEvent,
  SSEGapEvent,
  SSEDoneEvent,
} from "@/types/chat";

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
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chats`, {
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
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chats`, {
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

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chat/stream`, {
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
