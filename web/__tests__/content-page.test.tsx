import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ExtractionProgress } from "@/types";

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

const mockUploadDocument = vi.fn();
const mockListDocuments = vi.fn();
const mockDeleteDocument = vi.fn();
const mockStreamExtractKnowledge = vi.fn();

vi.mock("@/lib/api", () => ({
  uploadDocument: (...args: unknown[]) => mockUploadDocument(...args),
  listDocuments: (...args: unknown[]) => mockListDocuments(...args),
  deleteDocument: (...args: unknown[]) => mockDeleteDocument(...args),
  streamExtractKnowledge: (...args: unknown[]) =>
    mockStreamExtractKnowledge(...args),
}));

import ContentPage from "@/app/(app)/content/page";
import { AppStateProvider } from "@/lib/app-state";

function renderContentPage() {
  return render(
    <AppStateProvider>
      <ContentPage />
    </AppStateProvider>
  );
}

describe("ContentPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListDocuments.mockResolvedValue([]);
  });

  it("renders the page header and upload button", async () => {
    renderContentPage();

    expect(screen.getByText("Content")).toBeInTheDocument();
    expect(
      screen.getByText("Upload and manage your story files")
    ).toBeInTheDocument();
    expect(screen.getByText("Upload files")).toBeInTheDocument();
  });

  it("shows empty state when no files are uploaded", async () => {
    renderContentPage();

    await waitFor(() => {
      expect(screen.getByText("No files uploaded")).toBeInTheDocument();
    });
  });

  it("loads documents from backend on mount", async () => {
    mockListDocuments.mockResolvedValue([
      {
        id: "doc-1",
        filename: "chapter1.md",
        size: 2048,
        status: "uploaded",
        uploaded_at: "2026-02-28T12:00:00Z",
        chunks_stored: 0,
        error_message: null,
      },
      {
        id: "doc-2",
        filename: "chapter2.md",
        size: 4096,
        status: "extracted",
        uploaded_at: "2026-02-27T10:00:00Z",
        chunks_stored: 15,
        error_message: null,
      },
    ]);

    renderContentPage();

    await waitFor(() => {
      expect(screen.getByText("chapter1.md")).toBeInTheDocument();
      expect(screen.getByText("chapter2.md")).toBeInTheDocument();
    });
  });

  it("shows Extract button for uploaded files", async () => {
    mockListDocuments.mockResolvedValue([
      {
        id: "doc-1",
        filename: "story.md",
        size: 1024,
        status: "uploaded",
        uploaded_at: "2026-02-28T12:00:00Z",
        chunks_stored: 0,
        error_message: null,
      },
    ]);

    renderContentPage();

    await waitFor(() => {
      expect(screen.getByText("Extract")).toBeInTheDocument();
    });
  });

  it("shows chunk count badge for extracted files", async () => {
    mockListDocuments.mockResolvedValue([
      {
        id: "doc-1",
        filename: "story.md",
        size: 1024,
        status: "extracted",
        uploaded_at: "2026-02-28T12:00:00Z",
        chunks_stored: 25,
        error_message: null,
      },
    ]);

    renderContentPage();

    await waitFor(() => {
      expect(screen.getByText("25 chunks")).toBeInTheDocument();
    });
  });

  it("shows error badge and Retry button for errored files", async () => {
    mockListDocuments.mockResolvedValue([
      {
        id: "doc-1",
        filename: "broken.md",
        size: 512,
        status: "error",
        uploaded_at: "2026-02-28T12:00:00Z",
        chunks_stored: 0,
        error_message: "Pipeline failed",
      },
    ]);

    renderContentPage();

    await waitFor(() => {
      expect(screen.getByText("Error")).toBeInTheDocument();
      expect(screen.getByText("Pipeline failed")).toBeInTheDocument();
      expect(screen.getByText("Retry")).toBeInTheDocument();
    });
  });

  it("does not show Extract button for already-extracted files", async () => {
    mockListDocuments.mockResolvedValue([
      {
        id: "doc-1",
        filename: "done.md",
        size: 1024,
        status: "extracted",
        uploaded_at: "2026-02-28T12:00:00Z",
        chunks_stored: 10,
        error_message: null,
      },
    ]);

    renderContentPage();

    await waitFor(() => {
      expect(screen.getByText("done.md")).toBeInTheDocument();
    });
    expect(screen.queryByText("Extract")).not.toBeInTheDocument();
  });
});

describe("ContentPage upload flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListDocuments.mockResolvedValue([]);
  });

  it("adds file to list after successful upload", async () => {
    mockUploadDocument.mockResolvedValue({
      id: "new-doc",
      filename: "chapter3.md",
      size: 3072,
      status: "uploaded",
      uploaded_at: "2026-02-28T14:00:00Z",
    });

    renderContentPage();

    await waitFor(() => {
      expect(screen.getByText("No files uploaded")).toBeInTheDocument();
    });

    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const file = new File(["# Chapter 3\nContent here"], "chapter3.md", {
      type: "text/markdown",
    });

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    await waitFor(() => {
      expect(screen.getByText("chapter3.md")).toBeInTheDocument();
    });
    expect(mockUploadDocument).toHaveBeenCalledWith(file);
  });
});

describe("ContentPage extract dialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListDocuments.mockResolvedValue([
      {
        id: "doc-1",
        filename: "story.md",
        size: 1024,
        status: "uploaded",
        uploaded_at: "2026-02-28T12:00:00Z",
        chunks_stored: 0,
        error_message: null,
      },
    ]);
  });

  it("opens the extract dialog when clicking Extract", async () => {
    renderContentPage();

    await waitFor(() => {
      expect(screen.getByText("Extract")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Extract"));

    await waitFor(() => {
      expect(screen.getByText("Extract Knowledge")).toBeInTheDocument();
      expect(
        screen.getByText(/Select characters to extract knowledge about from/)
      ).toBeInTheDocument();
    });
  });

  it("shows character checkboxes in the dialog", async () => {
    renderContentPage();

    await waitFor(() => {
      expect(screen.getByText("Extract")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Extract"));

    await waitFor(() => {
      expect(screen.getByText("Select all")).toBeInTheDocument();
      expect(screen.getByText("PurpleFrog")).toBeInTheDocument();
    });
  });

  it("disables Run extraction when no characters selected", async () => {
    renderContentPage();

    await waitFor(() => {
      expect(screen.getByText("Extract")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Extract"));

    await waitFor(() => {
      const runButton = screen.getByText("Run extraction");
      expect(runButton.closest("button")).toBeDisabled();
    });
  });

  it("triggers extraction stream when characters are selected and Run is clicked", async () => {
    mockStreamExtractKnowledge.mockImplementation(
      async (
        _docId: string,
        _chars: string[],
        _opt: string,
        handlers: {
          onProgress: (e: ExtractionProgress) => void;
          onComplete: (e: { chunks_stored: number }) => void;
          onError: (msg: string) => void;
        }
      ) => {
        handlers.onProgress({ stage: "chunking", progressPct: 10 });
        handlers.onComplete({ chunks_stored: 8 });
      }
    );

    renderContentPage();

    await waitFor(() => {
      expect(screen.getByText("Extract")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Extract"));

    await waitFor(() => {
      expect(screen.getByText("PurpleFrog")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("PurpleFrog"));
    fireEvent.click(screen.getByText("Run extraction"));

    await waitFor(() => {
      expect(mockStreamExtractKnowledge).toHaveBeenCalledWith(
        "doc-1",
        ["PurpleFrog"],
        "advanced",
        expect.objectContaining({
          onProgress: expect.any(Function),
          onComplete: expect.any(Function),
          onError: expect.any(Function),
        })
      );
    });
  });

  it("shows extraction progress during streaming", async () => {
    let capturedHandlers: {
      onProgress: (e: ExtractionProgress) => void;
      onComplete: (e: { chunks_stored: number }) => void;
      onError: (msg: string) => void;
    } | null = null;

    mockStreamExtractKnowledge.mockImplementation(
      async (
        _docId: string,
        _chars: string[],
        _opt: string,
        handlers: typeof capturedHandlers
      ) => {
        capturedHandlers = handlers;
      }
    );

    renderContentPage();

    await waitFor(() => {
      expect(screen.getByText("Extract")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Extract"));
    await waitFor(() => {
      expect(screen.getByText("PurpleFrog")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("PurpleFrog"));
    fireEvent.click(screen.getByText("Run extraction"));

    await waitFor(() => {
      expect(capturedHandlers).not.toBeNull();
    });

    act(() => {
      capturedHandlers!.onProgress({
        stage: "classifying",
        progressPct: 40,
        chunksTotal: 10,
        chunksProcessed: 4,
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/Classifying chunks/)).toBeInTheDocument();
      expect(screen.getByText(/(4\/10)/)).toBeInTheDocument();
    });
  });

  it("shows extracted badge after extraction completes", async () => {
    mockStreamExtractKnowledge.mockImplementation(
      async (
        _docId: string,
        _chars: string[],
        _opt: string,
        handlers: {
          onProgress: (e: ExtractionProgress) => void;
          onComplete: (e: { chunks_stored: number }) => void;
          onError: (msg: string) => void;
        }
      ) => {
        handlers.onProgress({ stage: "chunking", progressPct: 10 });
        handlers.onProgress({
          stage: "embedding",
          progressPct: 85,
          chunksTotal: 12,
        });
        handlers.onComplete({ chunks_stored: 12 });
      }
    );

    renderContentPage();

    await waitFor(() => {
      expect(screen.getByText("Extract")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Extract"));
    await waitFor(() => {
      expect(screen.getByText("PurpleFrog")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("PurpleFrog"));
    fireEvent.click(screen.getByText("Run extraction"));

    await waitFor(() => {
      expect(screen.getByText("12 chunks")).toBeInTheDocument();
    });
    expect(screen.queryByText("Extract")).not.toBeInTheDocument();
  });

  it("shows error state after extraction fails", async () => {
    mockStreamExtractKnowledge.mockImplementation(
      async (
        _docId: string,
        _chars: string[],
        _opt: string,
        handlers: {
          onProgress: (e: ExtractionProgress) => void;
          onComplete: (e: { chunks_stored: number }) => void;
          onError: (msg: string) => void;
        }
      ) => {
        handlers.onProgress({ stage: "chunking", progressPct: 10 });
        handlers.onError("Pipeline failed");
      }
    );

    renderContentPage();

    await waitFor(() => {
      expect(screen.getByText("Extract")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Extract"));
    await waitFor(() => {
      expect(screen.getByText("PurpleFrog")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("PurpleFrog"));
    fireEvent.click(screen.getByText("Run extraction"));

    await waitFor(() => {
      expect(screen.getByText("Error")).toBeInTheDocument();
      expect(screen.getByText("Pipeline failed")).toBeInTheDocument();
      expect(screen.getByText("Retry")).toBeInTheDocument();
    });
  });
});

describe("ContentPage delete flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListDocuments.mockResolvedValue([
      {
        id: "doc-1",
        filename: "deleteme.md",
        size: 512,
        status: "uploaded",
        uploaded_at: "2026-02-28T12:00:00Z",
        chunks_stored: 0,
        error_message: null,
      },
    ]);
    mockDeleteDocument.mockResolvedValue(undefined);
  });

  it("removes file from list when deleted", async () => {
    renderContentPage();

    await waitFor(() => {
      expect(screen.getByText("deleteme.md")).toBeInTheDocument();
    });

    const deleteButtons = document.querySelectorAll(
      "button.opacity-0"
    ) as NodeListOf<HTMLButtonElement>;
    expect(deleteButtons.length).toBeGreaterThan(0);

    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.queryByText("deleteme.md")).not.toBeInTheDocument();
    });
    expect(mockDeleteDocument).toHaveBeenCalledWith("doc-1");
  });
});

describe("ContentPage graceful degradation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("still renders when backend is unavailable", async () => {
    mockListDocuments.mockRejectedValue(new Error("Network error"));

    renderContentPage();

    await waitFor(() => {
      expect(screen.getByText("No files uploaded")).toBeInTheDocument();
    });

    expect(screen.getByText("Upload files")).toBeInTheDocument();
  });
});
