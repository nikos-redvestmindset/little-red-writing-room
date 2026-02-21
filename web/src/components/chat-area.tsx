"use client";

import { useRef, useEffect } from "react";
import type { Message } from "@/types";
import { MessageBubble } from "@/components/message-bubble";
import { ChatInput } from "@/components/chat-input";

interface ChatAreaProps {
  messages: Message[];
  onSend: (message: string) => void;
  avatarName?: string;
}

export function ChatArea({ messages, onSend, avatarName }: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm italic">
              Start a conversation{avatarName ? ` with ${avatarName}` : ""}…
            </div>
          )}
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="shrink-0 border-t bg-background p-4">
        <div className="max-w-3xl mx-auto">
          <ChatInput onSend={onSend} />
        </div>
      </div>
    </div>
  );
}
