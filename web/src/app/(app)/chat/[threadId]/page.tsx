"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import type { Message } from "@/types";
import { ChatArea } from "@/components/chat-area";
import { listMessages, streamCharacterChat } from "@/lib/api";
import { useAppState } from "@/lib/app-state";

export default function ThreadPage() {
  const params = useParams<{ threadId: string }>();
  const threadId = params.threadId;
  const { chats, chatsLoading, characters } = useAppState();

  const chat = chats.find((c) => c.id === threadId);
  const character = chat
    ? characters.find((c) => c.id === chat.character_id)
    : null;

  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setMessagesLoading(true);
    listMessages(threadId)
      .then((data) => {
        if (cancelled) return;
        setMessages(
          data.map((m) => ({
            id: m.id,
            threadId: m.chat_id,
            role: m.role,
            content: m.content,
            avatarId: m.role === "assistant" ? chat?.character_id : undefined,
            citations: m.citations?.map((c) => ({
              sourceDocument: c.source,
              quote: c.text,
            })),
            gapFlags: m.gap_flags ?? undefined,
            createdAt: m.created_at,
          }))
        );
      })
      .catch((err) => {
        if (!cancelled) console.error("Failed to load messages:", err);
      })
      .finally(() => {
        if (!cancelled) setMessagesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [threadId, chat?.character_id]);

  const handleSend = useCallback(
    async (content: string) => {
      if (isStreaming) return;

      const userMsg: Message = {
        id: `msg-${Date.now()}`,
        threadId,
        role: "user",
        content,
        createdAt: new Date().toISOString(),
      };

      const assistantMsgId = `msg-${Date.now() + 1}`;
      const assistantMsg: Message = {
        id: assistantMsgId,
        threadId,
        role: "assistant",
        content: "",
        avatarId: character?.id,
        citations: [],
        gapFlags: [],
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      try {
        await streamCharacterChat(
          {
            chat_id: threadId,
            character_id: character?.id ?? "",
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
    [threadId, character, isStreaming]
  );

  if (chatsLoading || messagesLoading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm italic">
        Loading…
      </div>
    );
  }

  if (!chat) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm italic">
        Chat not found.
      </div>
    );
  }

  return (
    <ChatArea
      messages={messages}
      onSend={handleSend}
      avatarName={character?.name}
      disabled={isStreaming}
    />
  );
}
