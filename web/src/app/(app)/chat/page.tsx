"use client";

import { useState, useCallback, useRef } from "react";
import type { Character, Message } from "@/types";
import { AvatarSelector } from "@/components/avatar-selector";
import { ChatArea } from "@/components/chat-area";
import { createChat, streamCharacterChat } from "@/lib/api";
import { useAppState } from "@/lib/app-state";

export default function NewChatPage() {
  const { loadChats } = useAppState();
  const [selectedAvatar, setSelectedAvatar] = useState<Character | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const chatIdRef = useRef<string | null>(null);

  const handleSend = useCallback(
    async (content: string) => {
      if (!selectedAvatar || isStreaming) return;

      if (!chatIdRef.current) {
        const newChatId = crypto.randomUUID();
        chatIdRef.current = newChatId;
        try {
          await createChat(newChatId, selectedAvatar.id, truncateTitle(content));
          loadChats();
        } catch (err) {
          console.error("Failed to create chat:", err);
          chatIdRef.current = null;
          return;
        }
      }

      const userMsg: Message = {
        id: `msg-${Date.now()}`,
        threadId: chatIdRef.current,
        role: "user",
        content,
        createdAt: new Date().toISOString(),
      };

      const assistantMsgId = `msg-${Date.now() + 1}`;
      const assistantMsg: Message = {
        id: assistantMsgId,
        threadId: chatIdRef.current,
        role: "assistant",
        content: "",
        avatarId: selectedAvatar.id,
        citations: [],
        gapFlags: [],
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      try {
        await streamCharacterChat(
          {
            chat_id: chatIdRef.current,
            character_id: selectedAvatar.id,
            message: content,
          },
          {
            onToken: ({ text }) => {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, content: m.content + text }
                    : m
                )
              );
            },
            onCitation: (citation) => {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        citations: [
                          ...(m.citations ?? []),
                          {
                            sourceDocument: citation.source,
                            quote: citation.text,
                          },
                        ],
                      }
                    : m
                )
              );
            },
            onGap: (gap) => {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        gapFlags: [...(m.gapFlags ?? []), gap],
                      }
                    : m
                )
              );
            },
            onDone: () => {
              setIsStreaming(false);
            },
            onError: (err) => {
              console.error("Stream error:", err);
              setIsStreaming(false);
            },
          }
        );
      } catch (err) {
        console.error("Stream failed:", err);
        setIsStreaming(false);
      }
    },
    [selectedAvatar, isStreaming, loadChats]
  );

  if (!selectedAvatar) {
    return <AvatarSelector selectedId={null} onSelect={setSelectedAvatar} />;
  }

  return (
    <ChatArea
      messages={messages}
      onSend={handleSend}
      avatarName={selectedAvatar.name}
      disabled={isStreaming}
    />
  );
}

const MAX_TITLE_LENGTH = 40;

function truncateTitle(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= MAX_TITLE_LENGTH) return trimmed;
  const cut = trimmed.lastIndexOf(" ", MAX_TITLE_LENGTH);
  return (cut > 0 ? trimmed.slice(0, cut) : trimmed.slice(0, MAX_TITLE_LENGTH)) + "…";
}
