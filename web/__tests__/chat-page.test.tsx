import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SSECitationEvent, SSETokenEvent } from "@/types/chat";

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

const mockStreamCharacterChat = vi.fn();
const mockCreateChat = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/api", () => ({
  streamCharacterChat: (...args: unknown[]) => mockStreamCharacterChat(...args),
  createChat: (...args: unknown[]) => mockCreateChat(...args),
  listCharacters: vi.fn().mockResolvedValue([]),
  listDocuments: vi.fn().mockResolvedValue([]),
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
    ],
    charactersLoading: false,
    files: [],
    filesLoading: false,
    addCharacter: vi.fn(),
    deleteCharacter: vi.fn(),
    addFile: vi.fn(),
    deleteFile: vi.fn(),
    extractKnowledge: vi.fn(),
    loadFiles: vi.fn(),
    loadCharacters: vi.fn(),
  }),
  AppStateProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import NewChatPage from "@/app/(app)/chat/page";

describe("NewChatPage citation rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("crypto", { randomUUID: () => "test-chat-id" });
  });

  it("renders citation quotes with actual chunk text, not placeholders", async () => {
    mockStreamCharacterChat.mockImplementation(
      async (
        _req: unknown,
        handlers: {
          onToken: (e: SSETokenEvent) => void;
          onCitation: (e: SSECitationEvent) => void;
          onDone: () => void;
        }
      ) => {
        handlers.onToken({ text: "I remember leaping across the stones." });
        handlers.onCitation({
          source: "purplefrog-finds-her-brother.md",
          chunk_index: 0,
          text: "PurpleFrog leapt across the mossy stones.",
        });
        handlers.onCitation({
          source: "purplefrog-finds-her-brother.md",
          chunk_index: 1,
          text: "SnowRaven watched from the tall pine.",
        });
        handlers.onDone({ chat_id: "test-chat-id" });
      }
    );

    render(<NewChatPage />);

    fireEvent.click(screen.getByText("PF"));

    const textarea = screen.getByPlaceholderText(
      "Ask about your characters, scenes, or story…"
    );
    fireEvent.change(textarea, {
      target: { value: "Tell me about the stones" },
    });
    fireEvent.keyDown(textarea, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(
        screen.getByText(/PurpleFrog leapt across the mossy stones/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/SnowRaven watched from the tall pine/)
      ).toBeInTheDocument();
    });

    expect(screen.queryByText("[chunk 0]")).not.toBeInTheDocument();
    expect(screen.queryByText("[chunk 1]")).not.toBeInTheDocument();

    expect(screen.getAllByText("purplefrog-finds-her-brother.md")).toHaveLength(
      2
    );
  });
});
