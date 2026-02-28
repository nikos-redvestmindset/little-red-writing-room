import { describe, it, expect, vi, beforeEach } from "vitest";

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

import {
  uploadDocument,
  listDocuments,
  deleteDocument,
  streamExtractKnowledge,
} from "@/lib/api";
import type { ExtractionProgress } from "@/types";

function createSSEStream(frames: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const joined = frames.join("");
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(joined));
      controller.close();
    },
  });
}

describe("uploadDocument", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:8008");
  });

  it("sends multipart form data with auth header", async () => {
    const mockResponse = {
      id: "doc-1",
      filename: "story.md",
      size: 1024,
      status: "uploaded",
      uploaded_at: "2026-02-28T00:00:00Z",
    };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });
    vi.stubGlobal("fetch", mockFetch);

    const file = new File(["# Chapter 1"], "story.md", {
      type: "text/markdown",
    });
    const result = await uploadDocument(file);

    expect(result).toEqual(mockResponse);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8008/documents/upload",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer test-token" },
      })
    );
    const body = mockFetch.mock.calls[0][1].body as FormData;
    expect(body.get("file")).toBeInstanceOf(File);
  });

  it("throws on non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve("Bad request"),
      })
    );

    const file = new File(["data"], "test.exe", {
      type: "application/octet-stream",
    });
    await expect(uploadDocument(file)).rejects.toThrow(
      "Upload failed: HTTP 400"
    );
  });
});

describe("listDocuments", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:8008");
  });

  it("fetches documents with auth header", async () => {
    const docs = [
      {
        id: "doc-1",
        filename: "story.md",
        size: 1024,
        status: "uploaded",
        uploaded_at: "2026-02-28T00:00:00Z",
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(docs),
      })
    );

    const result = await listDocuments();
    expect(result).toEqual(docs);
  });

  it("throws on non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401 })
    );

    await expect(listDocuments()).rejects.toThrow("HTTP 401");
  });
});

describe("deleteDocument", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:8008");
  });

  it("sends DELETE with auth header", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    await deleteDocument("doc-1");

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8008/documents/doc-1",
      expect.objectContaining({
        method: "DELETE",
        headers: { Authorization: "Bearer test-token" },
      })
    );
  });
});

describe("streamExtractKnowledge", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:8008");
  });

  it("sends extract request with characters and pipeline option", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      body: createSSEStream([
        'event: complete\ndata: {"chunks_stored": 10}\n\n',
      ]),
    });
    vi.stubGlobal("fetch", mockFetch);

    await streamExtractKnowledge(
      "doc-1",
      ["PurpleFrog", "SnowRaven"],
      "advanced",
      {
        onProgress: () => {},
        onComplete: () => {},
        onError: () => {},
      }
    );

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8008/documents/doc-1/extract",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          selected_characters: ["PurpleFrog", "SnowRaven"],
          pipeline_option: "advanced",
        }),
      })
    );
  });

  it("calls onProgress for each progress event", async () => {
    const progressEvents: ExtractionProgress[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        body: createSSEStream([
          'event: progress\ndata: {"stage":"chunking","progress_pct":10,"chunks_total":null,"chunks_processed":null}\n\n',
          'event: progress\ndata: {"stage":"classifying","progress_pct":40,"chunks_total":20,"chunks_processed":8}\n\n',
          'event: complete\ndata: {"chunks_stored": 20}\n\n',
        ]),
      })
    );

    await streamExtractKnowledge("doc-1", ["PurpleFrog"], "advanced", {
      onProgress: (e) => progressEvents.push(e),
      onComplete: () => {},
      onError: () => {},
    });

    expect(progressEvents).toEqual([
      {
        stage: "chunking",
        progressPct: 10,
        chunksTotal: null,
        chunksProcessed: null,
      },
      {
        stage: "classifying",
        progressPct: 40,
        chunksTotal: 20,
        chunksProcessed: 8,
      },
    ]);
  });

  it("calls onComplete with chunk count", async () => {
    let completedChunks = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        body: createSSEStream([
          'event: progress\ndata: {"stage":"embedding","progress_pct":85,"chunks_total":15,"chunks_processed":null}\n\n',
          'event: complete\ndata: {"chunks_stored": 15}\n\n',
        ]),
      })
    );

    await streamExtractKnowledge("doc-1", ["PurpleFrog"], "advanced", {
      onProgress: () => {},
      onComplete: (e) => {
        completedChunks = e.chunks_stored;
      },
      onError: () => {},
    });

    expect(completedChunks).toBe(15);
  });

  it("calls onError for SSE error events", async () => {
    let errorMsg = "";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        body: createSSEStream([
          'event: progress\ndata: {"stage":"chunking","progress_pct":10,"chunks_total":null,"chunks_processed":null}\n\n',
          'event: error\ndata: {"message":"Pipeline failed"}\n\n',
        ]),
      })
    );

    await streamExtractKnowledge("doc-1", ["PurpleFrog"], "advanced", {
      onProgress: () => {},
      onComplete: () => {},
      onError: (msg) => {
        errorMsg = msg;
      },
    });

    expect(errorMsg).toBe("Pipeline failed");
  });

  it("calls onError for non-ok HTTP response", async () => {
    let errorMsg = "";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        text: () => Promise.resolve("Already extracting"),
      })
    );

    await streamExtractKnowledge("doc-1", ["PurpleFrog"], "advanced", {
      onProgress: () => {},
      onComplete: () => {},
      onError: (msg) => {
        errorMsg = msg;
      },
    });

    expect(errorMsg).toBe("HTTP 409 — Already extracting");
  });

  it("handles a full extraction lifecycle stream", async () => {
    const events: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        body: createSSEStream([
          'event: progress\ndata: {"stage":"chunking","progress_pct":10,"chunks_total":null,"chunks_processed":null}\n\n',
          'event: progress\ndata: {"stage":"classifying","progress_pct":25,"chunks_total":5,"chunks_processed":0}\n\n',
          'event: progress\ndata: {"stage":"classifying","progress_pct":47,"chunks_total":5,"chunks_processed":2}\n\n',
          'event: progress\ndata: {"stage":"classifying","progress_pct":69,"chunks_total":5,"chunks_processed":4}\n\n',
          'event: progress\ndata: {"stage":"classifying","progress_pct":80,"chunks_total":5,"chunks_processed":5}\n\n',
          'event: progress\ndata: {"stage":"embedding","progress_pct":85,"chunks_total":5,"chunks_processed":null}\n\n',
          'event: complete\ndata: {"chunks_stored":5}\n\n',
        ]),
      })
    );

    await streamExtractKnowledge(
      "doc-1",
      ["PurpleFrog", "SnowRaven"],
      "advanced",
      {
        onProgress: (e) => events.push(`progress:${e.stage}:${e.progressPct}`),
        onComplete: (e) => events.push(`complete:${e.chunks_stored}`),
        onError: (msg) => events.push(`error:${msg}`),
      }
    );

    expect(events).toEqual([
      "progress:chunking:10",
      "progress:classifying:25",
      "progress:classifying:47",
      "progress:classifying:69",
      "progress:classifying:80",
      "progress:embedding:85",
      "complete:5",
    ]);
  });
});
