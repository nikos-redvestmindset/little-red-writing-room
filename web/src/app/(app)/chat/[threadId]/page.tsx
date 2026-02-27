"use client";

import { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { getThreadMessages, getAvatarById, threads } from "@/lib/dummy-data";
import type { Message } from "@/types";
import { ChatArea } from "@/components/chat-area";
import { streamCharacterChat } from "@/lib/api";

export default function ThreadPage() {
  const params = useParams<{ threadId: string }>();
  const threadId = params.threadId;
  const thread = threads.find((t) => t.id === threadId);
  const avatar = thread ? getAvatarById(thread.avatarId) : null;

  const initialMessages = getThreadMessages(threadId);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isStreaming, setIsStreaming] = useState(false);

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
        avatarId: avatar?.id,
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
            character_id: avatar?.id ?? "",
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
                            quote: `[chunk ${citation.chunk_index}]`,
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
    [threadId, avatar, isStreaming]
  );

  if (!thread) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm italic">
        Thread not found.
      </div>
    );
  }

  return (
    <ChatArea
      messages={messages}
      onSend={handleSend}
      avatarName={avatar?.name}
      disabled={isStreaming}
    />
  );
}
