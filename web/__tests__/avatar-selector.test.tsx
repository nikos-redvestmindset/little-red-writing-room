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

vi.mock("@/lib/api", () => ({
  listCharacters: vi.fn().mockResolvedValue([
    {
      id: "purplefrog",
      name: "PurpleFrog",
      initials: "PF",
      color: "#7C3AED",
      created_at: "2024-01-01",
    },
    {
      id: "snowraven",
      name: "SnowRaven",
      initials: "SR",
      color: "#64748B",
      created_at: "2024-01-01",
    },
    {
      id: "ochramags",
      name: "OchraMags",
      initials: "OM",
      color: "#D97706",
      created_at: "2024-01-01",
    },
    {
      id: "myaxserp",
      name: "MyaxSerp",
      initials: "MY",
      color: "#DC2626",
      created_at: "2024-01-01",
    },
  ]),
  createCharacter: vi.fn(),
  deleteCharacterApi: vi.fn(),
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
