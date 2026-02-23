"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Character, Message } from "@/types";
import { AvatarSelector } from "@/components/avatar-selector";
import { ChatArea } from "@/components/chat-area";

export default function NewChatPage() {
  const router = useRouter();
  const [selectedAvatar, setSelectedAvatar] = useState<Character | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  function handleSend(content: string) {
    if (!selectedAvatar) return;

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      threadId: "new",
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };

    const aiMsg: Message = {
      id: `msg-${Date.now() + 1}`,
      threadId: "new",
      role: "assistant",
      content: `*${selectedAvatar.name} considers your question carefully...*\n\nThis is a placeholder response. Once the backend is connected, ${selectedAvatar.name} will respond in-character, grounded in your uploaded story documents.`,
      avatarId: selectedAvatar.id,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg, aiMsg]);
  }

  if (!selectedAvatar) {
    return <AvatarSelector selectedId={null} onSelect={setSelectedAvatar} />;
  }

  return (
    <ChatArea
      messages={messages}
      onSend={handleSend}
      avatarName={selectedAvatar.name}
    />
  );
}
