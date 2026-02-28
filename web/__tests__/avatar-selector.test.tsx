import { render, screen, fireEvent } from "@testing-library/react";
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
  it("renders all character avatars", () => {
    renderWithProvider(<AvatarSelector selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getByText("PurpleFrog")).toBeInTheDocument();
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

  it("calls onSelect when a character is clicked", () => {
    const onSelect = vi.fn();
    renderWithProvider(
      <AvatarSelector selectedId={null} onSelect={onSelect} />
    );
    fireEvent.click(screen.getByText("PurpleFrog"));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect.mock.calls[0][0].id).toBe("purplefrog");
  });

  it("renders character initials", () => {
    renderWithProvider(<AvatarSelector selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getByText("PF")).toBeInTheDocument();
    expect(screen.getByText("SR")).toBeInTheDocument();
  });
});
