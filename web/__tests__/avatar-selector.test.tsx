import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: () =>
        Promise.resolve({
          data: { session: { access_token: "test-token" } },
        }),
    },
  }),
}));

const mockCharacters = [
  {
    id: "purplefrog",
    entity_type: "character",
    name: "PurpleFrog",
    initials: "PF",
    color: "#7C3AED",
    created_at: "2024-01-01",
  },
  {
    id: "snowraven",
    entity_type: "character",
    name: "SnowRaven",
    initials: "SR",
    color: "#64748B",
    created_at: "2024-01-01",
  },
  {
    id: "ochramags",
    entity_type: "character",
    name: "OchraMags",
    initials: "OM",
    color: "#D97706",
    created_at: "2024-01-01",
  },
  {
    id: "myaxserp",
    entity_type: "character",
    name: "MyaxSerp",
    initials: "MY",
    color: "#DC2626",
    created_at: "2024-01-01",
  },
];

vi.mock("@/lib/api", () => ({
  listStoryEntities: vi.fn().mockImplementation((type: string) =>
    Promise.resolve(type === "character" ? mockCharacters : [])
  ),
  createStoryEntity: vi.fn(),
  deleteStoryEntity: vi.fn(),
  DuplicateStoryEntityError: class DuplicateStoryEntityError extends Error {},
  listChats: vi.fn().mockResolvedValue([]),
  uploadDocument: vi.fn(),
  listDocuments: vi.fn().mockResolvedValue([]),
  deleteDocument: vi.fn(),
  streamExtractKnowledge: vi.fn(),
}));

import { AvatarSelector } from "@/components/avatar-selector";
import { AppStateProvider } from "@/lib/app-state";

function renderWithProvider(ui: React.ReactElement) {
  return render(<AppStateProvider>{ui}</AppStateProvider>);
}

describe("AvatarSelector", () => {
  it("renders all character avatars", async () => {
    renderWithProvider(<AvatarSelector selectedId={null} onSelect={vi.fn()} />);
    expect(await screen.findByText("PurpleFrog")).toBeInTheDocument();
    expect(screen.getByText("SnowRaven")).toBeInTheDocument();
    expect(screen.getByText("OchraMags")).toBeInTheDocument();
    expect(screen.getByText("MyaxSerp")).toBeInTheDocument();
  });

  it("renders the selection prompt", () => {
    renderWithProvider(<AvatarSelector selectedId={null} onSelect={vi.fn()} />);
    expect(
      screen.getByText("Who would you like to talk to?")
    ).toBeInTheDocument();
  });

  it("calls onSelect when a character is clicked", async () => {
    const onSelect = vi.fn();
    renderWithProvider(
      <AvatarSelector selectedId={null} onSelect={onSelect} />
    );
    fireEvent.click(await screen.findByText("PurpleFrog"));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect.mock.calls[0][0].id).toBe("purplefrog");
  });

  it("renders character initials", async () => {
    renderWithProvider(<AvatarSelector selectedId={null} onSelect={vi.fn()} />);
    expect(await screen.findByText("PF")).toBeInTheDocument();
    expect(screen.getByText("SR")).toBeInTheDocument();
  });
});
