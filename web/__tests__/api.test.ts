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

import { streamCharacterChat } from "@/lib/api";

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

describe("streamCharacterChat", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:8008");
  });

  it("calls onToken for each token event", async () => {
    const tokens: string[] = [];
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      body: createSSEStream([
        'event: token\ndata: {"text": "Hello "}\n\n',
        'event: token\ndata: {"text": "world"}\n\n',
        'event: done\ndata: {"chat_id": "test-id"}\n\n',
      ]),
    });
    vi.stubGlobal("fetch", mockFetch);

    await streamCharacterChat(
      { chat_id: "test-id", character_id: "purplefrog", message: "Hi" },
      {
        onToken: (e) => tokens.push(e.text),
        onCitation: () => {},
        onGap: () => {},
        onDone: () => {},
        onError: () => {},
      }
    );

    expect(tokens).toEqual(["Hello ", "world"]);
  });

  it("calls onCitation for citation events with chunk text", async () => {
    const citations: { source: string; chunk_index: number; text: string }[] =
      [];
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      body: createSSEStream([
        'event: citation\ndata: {"source": "doc.md", "chunk_index": 0, "text": "PurpleFrog leapt across the mossy stones."}\n\n',
        'event: citation\ndata: {"source": "doc.md", "chunk_index": 1, "text": "SnowRaven watched from the tall pine."}\n\n',
        'event: done\ndata: {"chat_id": "test-id"}\n\n',
      ]),
    });
    vi.stubGlobal("fetch", mockFetch);

    await streamCharacterChat(
      { chat_id: "test-id", character_id: "purplefrog", message: "Hi" },
      {
        onToken: () => {},
        onCitation: (e) => citations.push(e),
        onGap: () => {},
        onDone: () => {},
        onError: () => {},
      }
    );

    expect(citations).toEqual([
      {
        source: "doc.md",
        chunk_index: 0,
        text: "PurpleFrog leapt across the mossy stones.",
      },
      {
        source: "doc.md",
        chunk_index: 1,
        text: "SnowRaven watched from the tall pine.",
      },
    ]);
  });

  it("calls onGap for gap events", async () => {
    const gaps: { attribute: string; suggestion: string }[] = [];
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      body: createSSEStream([
        'event: gap\ndata: {"attribute": "backstory", "suggestion": "Define it"}\n\n',
        'event: done\ndata: {"chat_id": "test-id"}\n\n',
      ]),
    });
    vi.stubGlobal("fetch", mockFetch);

    await streamCharacterChat(
      { chat_id: "test-id", character_id: "purplefrog", message: "Hi" },
      {
        onToken: () => {},
        onCitation: () => {},
        onGap: (e) => gaps.push(e),
        onDone: () => {},
        onError: () => {},
      }
    );

    expect(gaps).toEqual([{ attribute: "backstory", suggestion: "Define it" }]);
  });

  it("calls onDone when stream completes", async () => {
    let doneId = "";
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      body: createSSEStream(['event: done\ndata: {"chat_id": "abc-123"}\n\n']),
    });
    vi.stubGlobal("fetch", mockFetch);

    await streamCharacterChat(
      { chat_id: "abc-123", character_id: "purplefrog", message: "Hi" },
      {
        onToken: () => {},
        onCitation: () => {},
        onGap: () => {},
        onDone: (e) => {
          doneId = e.chat_id;
        },
        onError: () => {},
      }
    );

    expect(doneId).toBe("abc-123");
  });

  it("calls onError for non-ok responses", async () => {
    let errorMsg = "";
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    });
    vi.stubGlobal("fetch", mockFetch);

    await streamCharacterChat(
      { chat_id: "test-id", character_id: "purplefrog", message: "Hi" },
      {
        onToken: () => {},
        onCitation: () => {},
        onGap: () => {},
        onDone: () => {},
        onError: (err) => {
          errorMsg = err;
        },
      }
    );

    expect(errorMsg).toBe("HTTP 401");
  });

  it("sends auth header and correct body", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      body: createSSEStream(['event: done\ndata: {"chat_id": "test-id"}\n\n']),
    });
    vi.stubGlobal("fetch", mockFetch);

    await streamCharacterChat(
      { chat_id: "test-id", character_id: "purplefrog", message: "Hello" },
      {
        onToken: () => {},
        onCitation: () => {},
        onGap: () => {},
        onDone: () => {},
        onError: () => {},
      }
    );

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8008/chat/stream",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          chat_id: "test-id",
          character_id: "purplefrog",
          message: "Hello",
        }),
      })
    );
  });
});
