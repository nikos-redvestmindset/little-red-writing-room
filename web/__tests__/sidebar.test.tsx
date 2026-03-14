import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/chat",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/app-state", () => ({
  useAppState: () => ({
    characters: [
      {
        id: "purplefrog",
        name: "PurpleFrog",
        initials: "PF",
        color: "#7C3AED",
      },
      {
        id: "snowraven",
        name: "SnowRaven",
        initials: "SR",
        color: "#64748B",
      },
    ],
    charactersLoading: false,
    chats: [
      {
        id: "chat-1",
        character_id: "purplefrog",
        title: "PurpleFrog's motivations",
        created_at: "2026-02-21T14:00:00Z",
        updated_at: "2026-02-21T14:30:00Z",
      },
      {
        id: "chat-2",
        character_id: "snowraven",
        title: "SnowRaven character analysis",
        created_at: "2026-02-20T18:00:00Z",
        updated_at: "2026-02-20T18:45:00Z",
      },
      {
        id: "chat-3",
        character_id: "purplefrog",
        title: null,
        created_at: "2026-02-19T10:00:00Z",
        updated_at: "2026-02-19T10:00:00Z",
      },
    ],
    chatsLoading: false,
    files: [],
    filesLoading: false,
    addCharacter: vi.fn(),
    deleteCharacter: vi.fn(),
    addFile: vi.fn(),
    deleteFile: vi.fn(),
    extractKnowledge: vi.fn(),
    loadFiles: vi.fn(),
    loadCharacters: vi.fn(),
    loadChats: vi.fn(),
  }),
}));

import { AppSidebar } from "@/components/app-sidebar";

describe("AppSidebar", () => {
  it("renders the app title", () => {
    render(<AppSidebar />);
    expect(screen.getByText("Little Red Writing Room")).toBeInTheDocument();
  });

  it("renders the main navigation links", () => {
    render(<AppSidebar />);
    expect(screen.getByText("Chats")).toBeInTheDocument();
    expect(screen.getByText("Characters")).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("renders chat list from live data", () => {
    render(<AppSidebar />);
    expect(screen.getByText("PurpleFrog's motivations")).toBeInTheDocument();
    expect(
      screen.getByText("SnowRaven character analysis")
    ).toBeInTheDocument();
  });

  it("renders 'Untitled' for chats with null title", () => {
    render(<AppSidebar />);
    expect(screen.getByText("Untitled")).toBeInTheDocument();
  });

  it("shows character initials for each chat", () => {
    render(<AppSidebar />);
    const pfBadges = screen.getAllByText("PF");
    expect(pfBadges.length).toBe(2);
    expect(screen.getByText("SR")).toBeInTheDocument();
  });

  it("shows the Recent section header", () => {
    render(<AppSidebar />);
    expect(screen.getByText("Recent")).toBeInTheDocument();
  });

  it("renders the user menu", () => {
    render(<AppSidebar />);
    expect(screen.getByText("Story Writer")).toBeInTheDocument();
  });
});
