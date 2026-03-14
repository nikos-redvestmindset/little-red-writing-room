"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import type { Message } from "@/types";
import { ChatArea } from "@/components/chat-area";
import { Button } from "@/components/ui/button";
import { listMessages, streamCharacterChat, deleteChat } from "@/lib/api";
import { useAppState } from "@/lib/app-state";

export default function ThreadPage() {
  const params = useParams<{ threadId: string }>();
  const router = useRouter();
  const threadId = params.threadId;
  const { chats, chatsLoading, characters, loadChats } = useAppState();

  const chat = chats.find((c) => c.id === threadId);
  const character = chat
    ? characters.find((c) => c.id === chat.character_id)
    : null;

  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    if (!threadId || isDeleting) return;
    if (!window.confirm("Delete this chat? This cannot be undone.")) return;
    setIsDeleting(true);
    try {
      await deleteChat(threadId);
      router.push("/chat");
      loadChats();
    } catch (err) {
      console.error("Failed to delete chat:", err);
      setIsDeleting(false);
    }
  }, [threadId, isDeleting, loadChats, router]);

  useEffect(() => {
    if (!chat) return;
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
  }, [threadId, chat]);

  // Redirect to new-chat when this thread no longer exists (e.g. after delete)
  useEffect(() => {
    if (chatsLoading || !threadId) return;
    if (!chats.find((c) => c.id === threadId)) {
      router.replace("/chat");
    }
  }, [chatsLoading, chats, threadId, router]);

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
        Redirecting…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-2 border-b bg-background">
        <span className="text-sm font-medium truncate">
          {chat.title ?? "Untitled"}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDelete}
          disabled={isDeleting}
          className="shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          aria-label="Delete chat"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 min-h-0">
        <ChatArea
          messages={messages}
          onSend={handleSend}
          avatarName={character?.name}
          disabled={isStreaming}
        />
      </div>
    </div>
  );
}
