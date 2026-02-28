import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MessageBubble } from "@/components/message-bubble";
import type { Message } from "@/types";

vi.mock("@/lib/app-state", () => ({
  useAppState: () => ({
    characters: [
      {
        id: "purplefrog",
        name: "PurpleFrog",
        initials: "PF",
        color: "#7C3AED",
      },
    ],
  }),
}));

describe("MessageBubble", () => {
  const userMessage: Message = {
    id: "msg-1",
    threadId: "thread-1",
    role: "user",
    content: "What would PurpleFrog do?",
    createdAt: "2026-02-21T14:00:00Z",
  };

  const aiMessage: Message = {
    id: "msg-2",
    threadId: "thread-1",
    role: "assistant",
    content: "PurpleFrog would defy authority without hesitation.",
    avatarId: "purplefrog",
    citations: [
      {
        sourceDocument: "purplefrog-story-notes.md",
        quote: "PurpleFrog's core drive: protect SnowRaven at any cost.",
      },
    ],
    createdAt: "2026-02-21T14:01:00Z",
  };

  it("renders user message content", () => {
    render(<MessageBubble message={userMessage} />);
    expect(screen.getByText("What would PurpleFrog do?")).toBeInTheDocument();
  });

  it("renders assistant message content", () => {
    render(<MessageBubble message={aiMessage} />);
    expect(
      screen.getByText("PurpleFrog would defy authority without hesitation.")
    ).toBeInTheDocument();
  });

  it("renders citations for assistant messages", () => {
    render(<MessageBubble message={aiMessage} />);
    expect(screen.getByText("purplefrog-story-notes.md")).toBeInTheDocument();
  });

  it("renders avatar initials for assistant messages", () => {
    render(<MessageBubble message={aiMessage} />);
    expect(screen.getByText("PF")).toBeInTheDocument();
  });

  it("does not render avatar for user messages", () => {
    render(<MessageBubble message={userMessage} />);
    expect(screen.queryByText("PF")).not.toBeInTheDocument();
  });
});
