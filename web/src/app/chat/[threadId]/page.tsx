"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { getThreadMessages, getAvatarById, threads } from "@/lib/dummy-data";
import type { Message } from "@/types";
import { ChatArea } from "@/components/chat-area";

export default function ThreadPage() {
  const params = useParams<{ threadId: string }>();
  const threadId = params.threadId;
  const thread = threads.find((t) => t.id === threadId);
  const avatar = thread ? getAvatarById(thread.avatarId) : null;

  const initialMessages = getThreadMessages(threadId);
  const [messages, setMessages] = useState<Message[]>(initialMessages);

  function handleSend(content: string) {
    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      threadId,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };

    const aiMsg: Message = {
      id: `msg-${Date.now() + 1}`,
      threadId,
      role: "assistant",
      content: `*${
        avatar?.name ?? "Character"
      } considers your question carefully...*\n\nThis is a placeholder response. Once the backend is connected, responses will be grounded in your uploaded story documents.`,
      avatarId: avatar?.id,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg, aiMsg]);
  }

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
    />
  );
}
