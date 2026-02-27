# ADR-0002: Frontend–Backend Integration for Character Chat with SSE Streaming

**Status:** Accepted  
**Date:** 2026-02-26  
**Author:** Nikos  
**Relates to:** ARCHITECTURE.md (Section 2 — User Request Path), PRODUCT.md (Phase 1 — Character Interview Mode)

---

## Context

Little Red Writing Room lets fiction writers talk to their characters through a chat interface. The UI (screenshots in `/docs/ui`) shows a character selection screen and a chat window with the prompt "Start a conversation with PurpleFrog…". Writers type natural language questions and expect responses grounded in their uploaded story material.

The two major components of the system live in separate repository directories:

- `web/` — Next.js frontend, deployed on Vercel
- `srv/` — FastAPI backend, deployed on Render

This ADR records the decisions made about how those two directories connect: the HTTP contract, the streaming mechanism, the directory layout inside `srv/`, and the wiring conventions for the LangChain agent layer.

---

## Decision

### 1. Repository Structure

#### `web/` — existing layout (do not restructure)

```
web/
├── src/
│   ├── app/
│   │   ├── (app)/              # Authenticated route group
│   │   │   ├── characters/     # Character selection screen — already implemented
│   │   │   ├── chat/           # Chat window — already implemented
│   │   │   └── content/        # Content/upload screen — already implemented
│   │   ├── auth/               # Auth flow — already implemented
│   │   └── login/              # Login screen — already implemented
│   ├── components/             # Shared UI components — already implemented
│   ├── lib/                    # ← ADD HERE: API client and SSE helpers (see §3)
│   └── types/                  # ← ADD HERE: shared request/response types (see §3)
```

Only two additions are needed in `web/` to wire the backend:

| File | Purpose |
|---|---|
| `web/src/lib/api.ts` | `streamCharacterChat()` — typed `fetch`-based SSE client |
| `web/src/types/chat.ts` | `ChatStreamRequest` and SSE event payload types |

Everything else in `web/` is already in place.

#### `srv/` — new directory

```
srv/
    ├── app/                    # FastAPI application + config
    │   ├── __init__.py
    │   ├── main.py             # FastAPI app, lifespan, container wiring
    │   ├── config.py           # AppSettings (PYDANTIC_SETTINGS, env prefix APP_)
    │   ├── containers.py       # ApplicationContainer (dependency-injector)
    │   └── api/
    │       ├── __init__.py
    │       └── routes/
    │           ├── __init__.py
    │           ├── chat.py     # POST /chat/stream — SSE endpoint
    │           └── health.py   # GET /health
    │
    └── agents/                 # LangChain agents and tools
        ├── __init__.py
        ├── base.py             # AgentBuilder ABC (compile / _build)
        │
        ├── avatar/             # Avatar agent — in-character + analytical responses
        │   ├── __init__.py
        │   ├── agent.py        # AvatarAgentBuilder(_build)
        │   ├── config.py       # AvatarAgentSettings (env prefix AGENT_AVATAR_)
        │   ├── schemas.py      # AvatarInput / AvatarOutput / AvatarState TypedDicts
        │   └── prompts.py      # System + human prompt templates
        │
        ├── supervisor/         # Supervisor agent — intent routing + tool orchestration
        │   ├── __init__.py
        │   ├── agent.py        # SupervisorAgentBuilder(_build)
        │   ├── config.py       # SupervisorAgentSettings (env prefix AGENT_SUPERVISOR_)
        │   └── schemas.py      # SupervisorInput / SupervisorOutput / SupervisorState
        │
        ├── gap_detection/      # Gap Detection sub-agent — structures undefined attributes
        │   ├── __init__.py
        │   ├── agent.py        # GapDetectionAgentBuilder(_build)
        │   ├── config.py       # GapDetectionAgentSettings (env prefix AGENT_GAP_)
        │   └── schemas.py      # GapDetectionInput / GapDetectionOutput / GapResponse
        │
        ├── session/            # AvatarSessionService — stateless wrapper around the graph
        │   ├── __init__.py
        │   └── service.py      # Reads/writes Supabase; invokes graph; opens SSE
        │
        └── tools/
            ├── __init__.py
            ├── retrieval/      # Qdrant vector search + Cohere rerank tool
            │   ├── __init__.py
            │   ├── tool.py     # RetrievalToolBuilder
            │   ├── config.py   # RetrievalToolSettings (env prefix TOOL_RETRIEVAL_)
            │   └── schemas.py  # RetrievalResult Pydantic model
            └── tavily/         # Web search tool for external references
                ├── __init__.py
                ├── tool.py     # TavilyToolBuilder
                └── config.py   # TavilyToolSettings (env prefix TOOL_TAVILY_)
```

**Rationale:** `app/` owns everything FastAPI-specific — the server, routing, DI container wiring, and cross-cutting config. `agents/` is a pure Python layer with no FastAPI imports; it can be tested in isolation without spinning up a server. This mirrors the principle from the LangGraph best-practices guide that "no agent manages its own state" and that the service wrapper (`AvatarSessionService`) is the only object that touches Supabase.

---

### 2. HTTP Contract

#### Request — `POST /chat/stream`

```typescript
// web/src/types/chat.ts
interface ChatStreamRequest {
  chat_id:      string;   // UUID of the chat row — created by the frontend before the first turn (crypto.randomUUID())
  character_id: string;   // slug matching characters.id, e.g. "purplefrog"
  message:      string;   // the writer's question or prompt
}
```

```python
# srv/app/api/routes/chat.py
class ChatStreamRequest(BaseModel):
    chat_id:      str
    character_id: str
    message:      str
```

`user_id` is **not** passed in the request body. It is extracted on the backend from the Supabase JWT that the frontend includes in the `Authorization: Bearer <token>` header. The backend verifies the token and rejects any request whose `chat_id` does not belong to the authenticated user (see §4). This prevents one user from reading or writing another user's chat history by guessing a UUID.

#### Response — Server-Sent Events

The endpoint returns `Content-Type: text/event-stream`. Four event types flow over the stream:

| `event` field | `data` payload | Purpose |
|---|---|---|
| `token` | `{"text": "..."}` | One LLM token — appended by the frontend into the growing bubble |
| `citation` | `{"source": "...", "chunk_index": 0}` | Source reference for a grounding chunk |
| `gap` | `{"attribute": "...", "suggestion": "..."}` | Undefined attribute flagged by Gap Detection agent |
| `done` | `{"chat_id": "..."}` | Stream complete; frontend stops the spinner |

If the request fails after the stream has opened, an `error` event is sent with `{"code": "...", "message": "..."}` before the connection closes.

#### CORS

`web/` and `srv/` are deployed on different origins (Vercel vs. Render). The FastAPI app permits `https://*.vercel.app` in development and the exact production Vercel domain in production, both configured via `APP_CORS_ORIGINS` in the environment.

---

### 3. Frontend SSE Integration (`web/`)

Before opening a stream the chat page ensures a `chat_id` exists. On the first message in a new conversation it creates one with `crypto.randomUUID()` and immediately calls `POST /chats` to persist the row (see §6 CRUD routes). On subsequent turns in the same conversation it reuses the existing `chat_id` from local state or the URL.

The stream itself uses the `fetch` API (needed for `POST` with a body, which the native `EventSource` does not support):

```typescript
// web/src/types/chat.ts
export interface ChatStreamRequest {
  chat_id:      string;
  character_id: string;
  message:      string;
}

export type SSETokenEvent    = { text: string };
export type SSECitationEvent = { source: string; chunk_index: number };
export type SSEGapEvent      = { attribute: string; suggestion: string };
export type SSEDoneEvent     = { chat_id: string };
export type SSEErrorEvent    = { code: string; message: string };
```

```typescript
// web/src/lib/api.ts
import { createClient } from "@/lib/supabase/client";
import type { ChatStreamRequest, SSETokenEvent, SSECitationEvent, SSEGapEvent, SSEDoneEvent } from "@/types/chat";

async function getBearerToken(): Promise<string> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  return session.access_token;   // Supabase JWT — verified by the backend
}

export async function streamCharacterChat(
  req: ChatStreamRequest,
  handlers: {
    onToken:    (e: SSETokenEvent)    => void;
    onCitation: (e: SSECitationEvent) => void;
    onGap:      (e: SSEGapEvent)      => void;
    onDone:     (e: SSEDoneEvent)     => void;
    onError:    (err: string)         => void;
  }
): Promise<void> {
  const token = await getBearerToken();

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    handlers.onError(`HTTP ${res.status}`);
    return;
  }

  const reader  = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer    = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const eventLine = frame.match(/^event: (.+)$/m)?.[1];
      const dataLine  = frame.match(/^data: (.+)$/m)?.[1];
      if (!dataLine) continue;

      const payload = JSON.parse(dataLine);
      if (eventLine === "token")    handlers.onToken(payload);
      if (eventLine === "citation") handlers.onCitation(payload);
      if (eventLine === "gap")      handlers.onGap(payload);
      if (eventLine === "done")     handlers.onDone(payload);
      if (eventLine === "error")    handlers.onError(payload.message);
    }
  }
}
```

---

### 4. Backend SSE Endpoint (`srv/app/api/routes/chat.py`)

The endpoint extracts `user_id` from the verified Supabase JWT via a FastAPI dependency. It then ownership-checks that the `chat_id` belongs to that user before handing off to the session service, returning `403` if not.

```python
# srv/app/api/routes/chat.py
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from dependency_injector.wiring import inject, Provide
from pydantic import BaseModel

from app.containers import ApplicationContainer
from app.auth import verify_supabase_jwt          # thin wrapper around supabase-py verify
from agents.session.service import AvatarSessionService

router   = APIRouter()
security = HTTPBearer()

class ChatStreamRequest(BaseModel):
    chat_id:      str   # UUID string
    character_id: str
    message:      str

async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    """Verify the Supabase JWT and return the authenticated user_id (sub claim)."""
    payload = verify_supabase_jwt(credentials.credentials)
    return payload["sub"]   # Supabase user UUID

@router.post("/chat/stream")
@inject
async def chat_stream(
    body:    ChatStreamRequest,
    user_id: str = Depends(get_current_user_id),
    session_service: AvatarSessionService = Depends(
        Provide[ApplicationContainer.avatar_session_service]
    ),
) -> StreamingResponse:
    """
    Open an SSE stream for a single chat turn.

    Ownership is checked before the stream opens — a 403 is returned
    synchronously if chat_id does not belong to user_id.
    The stream itself then yields: token* → citation* → gap* → done.
    """
    # Ownership check — raises 403 if chat does not belong to user
    await session_service.assert_chat_owner(
        chat_id=body.chat_id,
        user_id=user_id,
    )

    return StreamingResponse(
        session_service.stream(
            chat_id=body.chat_id,
            user_id=user_id,
            character_id=body.character_id,
            message=body.message,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control":    "no-cache",
            "X-Accel-Buffering": "no",   # Disable Nginx buffering on Render
        },
    )
```

```python
# srv/app/auth.py
import os
from jose import jwt, JWTError
from fastapi import HTTPException

SUPABASE_JWT_SECRET = os.environ["SUPABASE_JWT_SECRET"]  # from Supabase project settings

def verify_supabase_jwt(token: str) -> dict:
    try:
        return jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except JWTError as e:
        raise HTTPException(status_code=401, detail=str(e))
```

The `AvatarSessionService.stream()` method is an `async generator` that:

1. Reads conversation history + narrative state from Supabase, scoped to `(chat_id, user_id)`.
2. Assembles the full input bundle and calls `supervisor_graph.astream(...)`.
3. Yields `event: token\ndata: {...}\n\n` frames as they arrive from the Avatar agent's SSE callback.
4. Yields `event: citation` and `event: gap` frames from the supervisor's output bundle.
5. Persists the new messages and updated narrative state to Supabase.
6. Yields `event: done\ndata: {"chat_id": "..."}\n\n` to close the stream.

---

### 5. Supabase Data Model

Three tables support the chat feature. All use Supabase's built-in `auth.users` for the `user_id` foreign key so Row Level Security (RLS) policies can reference `auth.uid()` directly.

#### `chats`

One row per conversation thread. Created by the frontend before the first message is sent.

```sql
create table chats (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  character_id  text not null,          -- e.g. "purplefrog"
  title         text,                   -- auto-generated from first message; nullable until then
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()  -- bumped on every new message
);

-- RLS: users can only see and modify their own chats
alter table chats enable row level security;

create policy "owner access" on chats
  using (user_id = auth.uid());
```

`updated_at` is bumped on every insert to `messages` via a trigger (see below). The sidebar in the UI sorts by `updated_at desc` to surface the most recent conversations first, which matches what the screenshots show.

#### `messages`

One row per turn (user message or assistant reply). Appended at the end of each SSE stream.

```sql
create type message_role as enum ('user', 'assistant');

create table messages (
  id          uuid primary key default gen_random_uuid(),
  chat_id     uuid not null references chats(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        message_role not null,
  content     text not null,            -- full assembled text (not tokens)
  citations   jsonb,                    -- [{source, chunk_index}] or null
  gap_flags   jsonb,                    -- [{attribute, suggestion}] or null
  created_at  timestamptz not null default now()
);

-- RLS: users can only see messages belonging to their own chats
alter table messages enable row level security;

create policy "owner access" on messages
  using (
    exists (
      select 1 from chats
      where chats.id = messages.chat_id
        and chats.user_id = auth.uid()
    )
  );

-- Keep chats.updated_at current whenever a message is added
create or replace function bump_chat_updated_at()
returns trigger language plpgsql as $$
begin
  update chats set updated_at = now() where id = new.chat_id;
  return new;
end;
$$;

create trigger on_message_insert
  after insert on messages
  for each row execute procedure bump_chat_updated_at();
```

#### `narrative_state`

One row per chat, updated after every assistant turn. Stores the supervisor's `narrative_state_delta` output — whatever structured story state has accumulated (active character traits surfaced so far, Story Grid tags observed, gap flags, etc.). Kept separate from `messages` so it can grow without bloating the message history read on every turn.

```sql
create table narrative_state (
  chat_id     uuid primary key references chats(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  state       jsonb not null default '{}',
  updated_at  timestamptz not null default now()
);

alter table narrative_state enable row level security;

create policy "owner access" on narrative_state
  using (user_id = auth.uid());
```

#### Read pattern in `AvatarSessionService`

On each turn the service performs two reads before invoking the graph:

```python
# srv/agents/session/service.py (read phase, abbreviated)

# 1. Verify ownership (also done in the route, but service is defensive)
chat = await supabase.table("chats")
    .select("id, character_id, user_id")
    .eq("id", chat_id).eq("user_id", user_id)
    .single().execute()

# 2. Last N messages as conversation history
history = await supabase.table("messages")
    .select("role, content")
    .eq("chat_id", chat_id)
    .order("created_at", desc=False)
    .limit(settings.history_window)     # configurable, default 20
    .execute()

# 3. Current narrative state
state_row = await supabase.table("narrative_state")
    .select("state")
    .eq("chat_id", chat_id)
    .maybe_single().execute()           # null on first turn, handled gracefully
```

After the stream completes, the service writes two rows atomically (Supabase `rpc` or sequential inserts — both acceptable since there is no concurrent write risk per chat):

```python
# Write phase
await supabase.table("messages").insert([
    {"chat_id": chat_id, "user_id": user_id, "role": "user",      "content": message},
    {"chat_id": chat_id, "user_id": user_id, "role": "assistant",  "content": assembled_response,
     "citations": citations, "gap_flags": gap_flags},
]).execute()

await supabase.table("narrative_state").upsert({
    "chat_id": chat_id, "user_id": user_id,
    "state":   merged_state,
    "updated_at": "now()",
}).execute()
```

---

### 6. CRUD Routes for Chat Management (`srv/app/api/routes/chats.py`)

These are standard REST endpoints, not SSE. They support the sidebar listing, chat creation, rename, and delete operations visible in the UI screenshots.

```python
# srv/app/api/routes/chats.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

# ── Models ────────────────────────────────────────────────────────────────────

class ChatCreate(BaseModel):
    chat_id:      str        # client-generated UUID (crypto.randomUUID())
    character_id: str
    title:        Optional[str] = None   # may be None on creation; set after first reply

class ChatUpdate(BaseModel):
    title: str

# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/chats")
async def list_chats(user_id: str = Depends(get_current_user_id)):
    """Return all chats for the user, ordered by updated_at desc."""
    # RLS on the chats table means this only ever returns the user's own rows
    ...

@router.post("/chats", status_code=201)
async def create_chat(
    body:    ChatCreate,
    user_id: str = Depends(get_current_user_id),
):
    """
    Persist a new chat row before the first message is sent.
    The frontend calls this immediately after generating a chat_id
    so the row exists when the first /chat/stream request arrives.
    """
    ...

@router.patch("/chats/{chat_id}")
async def rename_chat(
    chat_id: str,
    body:    ChatUpdate,
    user_id: str = Depends(get_current_user_id),
):
    """Rename a chat. Returns 403 if chat_id does not belong to user."""
    ...

@router.delete("/chats/{chat_id}", status_code=204)
async def delete_chat(
    chat_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """
    Delete a chat and cascade to messages + narrative_state.
    ON DELETE CASCADE in the schema handles the child rows.
    Returns 403 if chat_id does not belong to user.
    """
    ...
```

All four endpoints delegate ownership checks to Supabase RLS — a `select` or `update` that returns zero rows is treated as a `403` (not a `404`) to avoid leaking whether a chat_id exists at all.

The `main.py` router registration becomes:

```python
app.include_router(chat.router,  prefix="/chat")   # SSE streaming
app.include_router(chats.router, prefix="/chats")  # CRUD
app.include_router(health.router)
```

---

### 7. Dependency Injection Wiring (`srv/app/containers.py`)

The `ApplicationContainer` follows the `dependency-injector` `DeclarativeContainer` pattern from the DI design guide. Expensive resources (LLM, Qdrant client, Cohere client, Supabase client) are **Singletons**. The agent builders and session service are **Factories** — new instances per request, no shared mutable state.

```python
# srv/app/containers.py (abbreviated)
from dependency_injector import containers, providers
from langchain_openai import ChatOpenAI
from qdrant_client import AsyncQdrantClient

from app.config import AppSettings
from agents.tools.retrieval.tool import RetrievalToolBuilder
from agents.tools.retrieval.config import RetrievalToolSettings
from agents.tools.tavily.tool import TavilyToolBuilder
from agents.tools.tavily.config import TavilyToolSettings
from agents.avatar.agent import AvatarAgentBuilder
from agents.avatar.config import AvatarAgentSettings
from agents.gap_detection.agent import GapDetectionAgentBuilder
from agents.gap_detection.config import GapDetectionAgentSettings
from agents.supervisor.agent import SupervisorAgentBuilder
from agents.supervisor.config import SupervisorAgentSettings
from agents.session.service import AvatarSessionService

class ApplicationContainer(containers.DeclarativeContainer):
    wiring_config = containers.WiringConfiguration(
        modules=[
            "app.api.routes.chat",
            "app.api.routes.chats",
        ]
    )

    # ── Settings ──────────────────────────────────────────────────────────
    app_settings             = providers.Singleton(AppSettings)
    retrieval_tool_settings  = providers.Singleton(RetrievalToolSettings)
    tavily_tool_settings     = providers.Singleton(TavilyToolSettings)
    avatar_settings          = providers.Singleton(AvatarAgentSettings)
    gap_detection_settings   = providers.Singleton(GapDetectionAgentSettings)
    supervisor_settings      = providers.Singleton(SupervisorAgentSettings)

    # ── External clients (Singleton — reuse connection pools) ─────────────
    llm = providers.Singleton(
        ChatOpenAI,
        model=app_settings.provided.llm_model,
        api_key=app_settings.provided.openai_api_key,
        streaming=True,
    )
    qdrant_client = providers.Singleton(
        AsyncQdrantClient,
        url=retrieval_tool_settings.provided.qdrant_url,
        api_key=retrieval_tool_settings.provided.qdrant_api_key,
    )

    # ── Tool builders (Factory — stateless, new per request)
    # These produce LangChain tools via .build(), not CompiledStateGraphs.
    # Naming: *_tool_builder to distinguish from sub-agent builders.
    retrieval_tool_builder = providers.Factory(
        RetrievalToolBuilder,
        settings=retrieval_tool_settings,
        qdrant_client=qdrant_client,
    )
    tavily_tool_builder = providers.Factory(
        TavilyToolBuilder,
        settings=tavily_tool_settings,
    )

    # ── Sub-agent builders (Factory — produce CompiledStateGraphs via .compile())
    # Naming: *_agent_builder to distinguish from tool builders.
    avatar_agent_builder = providers.Factory(
        AvatarAgentBuilder,
        llm=llm,
        settings=avatar_settings,
    )
    gap_detection_builder = providers.Factory(
        GapDetectionAgentBuilder,
        llm=llm,
        settings=gap_detection_settings,
    )

    # ── Supervisor (Factory) — receives all tool and sub-agent builders ────
    supervisor_agent = providers.Factory(
        SupervisorAgentBuilder,
        llm=llm,
        settings=supervisor_settings,
        retrieval_tool_builder=retrieval_tool_builder,    # → .build() → LangChain tool
        tavily_tool_builder=tavily_tool_builder,          # → .build() → LangChain tool
        avatar_agent_builder=avatar_agent_builder,        # → .compile() → CompiledStateGraph
        gap_detection_builder=gap_detection_builder,      # → .compile() → CompiledStateGraph
    )

    # ── Session service (Factory) ──────────────────────────────────────────
    avatar_session_service = providers.Factory(
        AvatarSessionService,
        supervisor_agent=supervisor_agent,
        supabase_url=app_settings.provided.supabase_url,
        supabase_key=app_settings.provided.supabase_service_key,
    )
```

---

### 8. Agent Builder Pattern (`srv/agents/`)

All agents extend `AgentBuilder` from `agents/base.py`. The public API is `compile()` — sealed with `@final` and an `__init_subclass__` guard. Subclasses implement `_build()` only.

```python
# srv/agents/supervisor/agent.py (abbreviated)
from langgraph.graph import StateGraph, END
from agents.base import AgentBuilder
from agents.supervisor.schemas import SupervisorState, SupervisorInput, SupervisorOutput

class SupervisorAgentBuilder(AgentBuilder):
    """
    Orchestrates a single chat turn.

    Node naming convention:
      _node   — pure graph node (LLM call or logic, no external tool invocation)
      _tool   — invokes a LangChain tool and returns its result to state
      _agent  — delegates to a compiled sub-agent graph

    Flow:
      classify_intent_node
        → call_retrieval_tool
        → [conditional] call_tavily_tool
        → [conditional] call_gap_detection_agent
        → call_avatar_agent
        → END → SupervisorOutput bundle

    Dependencies:
        llm:                    ChatOpenAI singleton
        settings:               SupervisorAgentSettings
        retrieval_tool_builder: RetrievalToolBuilder  (tool, always called)
        tavily_tool_builder:    TavilyToolBuilder     (tool, conditional)
        avatar_agent_builder:   AvatarAgentBuilder    (sub-agent, always called)
        gap_detection_builder:  GapDetectionAgentBuilder (sub-agent, conditional)
    """

    def __init__(
        self,
        llm,
        settings,
        retrieval_tool_builder,
        tavily_tool_builder,
        avatar_agent_builder,
        gap_detection_builder,
    ):
        self.llm                    = llm
        self.settings               = settings
        self.retrieval_tool         = retrieval_tool_builder.build()   # LangChain tool
        self.tavily_tool            = tavily_tool_builder.build()      # LangChain tool
        self.avatar_agent           = avatar_agent_builder.compile()   # CompiledStateGraph
        self.gap_detection_agent    = gap_detection_builder.compile()  # CompiledStateGraph

    def _build(self):
        graph = StateGraph(
            SupervisorState,
            input=SupervisorInput,
            output=SupervisorOutput,
        )

        # ── Nodes ──────────────────────────────────────────────────────────
        # _node   : LLM call or routing logic — no external service invoked
        # _tool   : wraps a LangChain tool call; result written back to state
        # _agent  : invokes a compiled sub-agent graph via "invoke from a node"

        graph.add_node("classify_intent_node",       self._classify_intent_node)
        graph.add_node("call_retrieval_tool",         self._call_retrieval_tool)
        graph.add_node("call_tavily_tool",            self._call_tavily_tool)
        graph.add_node("call_gap_detection_agent",    self._call_gap_detection_agent)
        graph.add_node("call_avatar_agent",           self._call_avatar_agent)

        # ── Edges ──────────────────────────────────────────────────────────
        graph.set_entry_point("classify_intent_node")
        graph.add_edge("classify_intent_node", "call_retrieval_tool")

        # After retrieval: branch to Tavily if external references were detected,
        # otherwise go straight to gap detection check
        graph.add_conditional_edges(
            "call_retrieval_tool",
            self._needs_tavily_tool,
            {"yes": "call_tavily_tool", "no": "call_gap_detection_agent"},
        )
        graph.add_edge("call_tavily_tool", "call_gap_detection_agent")

        # After gap detection check (or skip): always call avatar
        graph.add_conditional_edges(
            "call_gap_detection_agent",
            self._needs_gap_detection_agent,
            {"yes": "call_gap_detection_agent", "no": "call_avatar_agent"},
        )
        graph.add_edge("call_gap_detection_agent", "call_avatar_agent")
        graph.add_edge("call_avatar_agent", END)

        return graph.compile()

    # ── Node implementations ──────────────────────────────────────────────

    async def _classify_intent_node(self, state: SupervisorState) -> dict:
        """LLM call: classify intent + resolve characters. No tool invoked."""
        ...

    async def _call_retrieval_tool(self, state: SupervisorState) -> dict:
        """Invoke the Retrieval LangChain tool. Writes RetrievalResult to state."""
        result = await self.retrieval_tool.arun({
            "query":      state["message"],
            "characters": state["resolved_characters"],
            "intent":     state["intent"],
        })
        return {"retrieval_result": result}

    async def _call_tavily_tool(self, state: SupervisorState) -> dict:
        """Invoke the Tavily LangChain tool. Writes external context to state."""
        result = await self.tavily_tool.arun({
            "queries": state["retrieval_result"].external_references,
        })
        return {"tavily_result": result}

    async def _call_gap_detection_agent(self, state: SupervisorState) -> dict:
        """Invoke the GapDetection sub-agent graph. Writes gap_flags to state."""
        result = await self.gap_detection_agent.ainvoke({
            "query":            state["message"],
            "retrieval_result": state["retrieval_result"],
        })
        return {"gap_flags": result["gap_flags"]}

    async def _call_avatar_agent(self, state: SupervisorState) -> dict:
        """Invoke the Avatar sub-agent graph. Streams tokens; writes response to state."""
        result = await self.avatar_agent.ainvoke({
            "query":            state["message"],
            "intent":           state["intent"],
            "retrieval_result": state["retrieval_result"],
            "tavily_result":    state.get("tavily_result"),
            "gap_flags":        state.get("gap_flags", []),
        })
        return {"response_text": result["response_text"], "citations": result["citations"]}

    # ── Routing predicates ────────────────────────────────────────────────

    def _needs_tavily_tool(self, state: SupervisorState) -> str:
        """Route to Tavily tool if retrieval found external references."""
        has_refs = bool(state.get("retrieval_result", {}).get("external_references"))
        return "yes" if has_refs else "no"

    def _needs_gap_detection_agent(self, state: SupervisorState) -> str:
        """Route to GapDetection sub-agent if retrieval confidence is low."""
        low = state.get("retrieval_result", {}).get("low_confidence", False)
        return "yes" if low else "no"
```

The `AvatarAgentBuilder` follows the same pattern. Its `_run_avatar` node uses LangChain's `astream_events` API to yield tokens back through the supervisor into `AvatarSessionService.stream()`, which wraps them as SSE frames.

---

### 9. Settings Convention

Each package owns its settings via a `BaseSettings` subclass with an env-var prefix. The full set of prefixes:

| Prefix | Owns |
|---|---|
| `APP_` | `AppSettings` in `srv/app/config.py` — server port, CORS origins, Supabase URL/key, OpenAI key |
| `AGENT_AVATAR_` | `AvatarAgentSettings` in `srv/agents/avatar/config.py` |
| `AGENT_SUPERVISOR_` | `SupervisorAgentSettings` in `srv/agents/supervisor/config.py` |
| `AGENT_GAP_` | `GapDetectionAgentSettings` in `srv/agents/gap_detection/config.py` |
| `TOOL_RETRIEVAL_` | `RetrievalToolSettings` in `srv/agents/tools/retrieval/config.py` — Qdrant URL/key, collection name, top-k, Cohere key |
| `TOOL_TAVILY_` | `TavilyToolSettings` in `srv/agents/tools/tavily/config.py` |

All settings are validated by Pydantic at startup. A missing required variable raises `ValidationError` before any request is served — fail fast, not silently at first use.

---

### 10. Application Lifespan (`srv/app/main.py`)

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.containers import ApplicationContainer

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup — initialize singleton clients
    container = app.state.container
    qdrant = container.qdrant_client()
    await qdrant.initialize()          # warm connection pool

    yield

    # Shutdown — close connection pools
    await qdrant.close()

def create_app() -> FastAPI:
    container = ApplicationContainer()
    container.wire(modules=["app.api.routes.chat"])

    app = FastAPI(lifespan=lifespan)
    app.state.container = container

    from app.api.routes import chat, chats, health
    app.include_router(chat.router,   prefix="/chat")    # SSE streaming
    app.include_router(chats.router,  prefix="/chats")   # CRUD
    app.include_router(health.router, prefix="/health")

    return app

app = create_app()
```

---

## Consequences

**Positive**

- `user_id` is never trusted from the client. It is derived from the verified JWT on every request, so ownership is enforced at the API boundary rather than relying on the frontend to send the right value.
- RLS on all three Supabase tables (`chats`, `messages`, `narrative_state`) means a misconfigured backend that forgets an ownership check still cannot leak another user's data — the database itself enforces isolation.
- The `chats` → `messages` → `narrative_state` cascade means deleting a chat is a single `DELETE` with no orphan cleanup required.
- The `bump_chat_updated_at` trigger keeps `chats.updated_at` accurate for sidebar sorting without any application-layer bookkeeping.
- The `agents/` directory is fully decoupled from FastAPI. Agent builders can be unit-tested by calling `compile()` directly and invoking the compiled graph with a mock state — no HTTP layer involved.
- The SSE contract is minimal and typed on both sides. Adding a new event type (e.g. `narrative_state`) requires a one-line change in the `AvatarSessionService` generator and a matching handler in `web/src/lib/api.ts`.

**Negative / Trade-offs**

- `SUPABASE_JWT_SECRET` must be provisioned as a Render environment variable. Rotating the Supabase JWT secret (rare but possible) requires redeploying the backend. Alternatively, the Supabase Admin SDK's `get_user(token)` method can be used for server-side verification without holding the secret — a worthwhile swap if secret rotation becomes a concern.
- The frontend must call `POST /chats` before `POST /chat/stream` on the first turn of a new conversation. This is a two-request sequence; if the first succeeds and the second fails, the chat row exists but is empty. The frontend should handle this by retrying the stream rather than creating a second chat row.
- Render's free tier does not support long-lived SSE connections without Keep-Alive tuning. The `X-Accel-Buffering: no` header is required, and the `gunicorn`/`uvicorn` worker timeout must be set above the expected maximum response time (~60 seconds for agentic chains).
- `fetch`-based SSE on the frontend requires more boilerplate than the native `EventSource` API. The `web/src/lib/api.ts` helper encapsulates this, but it is a custom implementation that must be maintained.
- The `dependency-injector` wiring config must enumerate every route module explicitly. Forgetting to add a new route module is a silent failure — injection falls back to default values rather than raising at startup.

---

## Alternatives Considered

**Pass `user_id` in the request body** — Rejected. Trusting the client to send its own `user_id` is a standard IDOR vulnerability. Extracting it from the JWT on the backend is the correct pattern regardless of whether Supabase RLS is also enforcing it.

**Single `messages` table with no separate `narrative_state`** — Rejected. Narrative state is a structured, mutable document that gets merged and overwritten on every turn. Storing it as a JSONB column on the most recent `assistant` message would make reads fragile (always fetch last assistant row, parse it, handle empty history). A dedicated table with `upsert` semantics is cleaner.

**Auto-generate `chat_id` on the backend (`POST /chats` returns the id)** — Considered. Client-generated UUIDs (`crypto.randomUUID()`) are equally safe and remove a round-trip before the first message. Either approach is acceptable; client generation was chosen to keep the first-message flow a single `POST /chat/stream` call once the chat row exists.

**WebSockets instead of SSE** — Rejected. The chat interaction is strictly half-duplex: one user message produces one streaming response. SSE is simpler to implement, simpler to proxy, and sufficient for this pattern.

**LangServe for the streaming endpoint** — Rejected. LangServe's `/stream` route does not support the custom SSE event types (`citation`, `gap`, `done`) without patching the response format. A hand-rolled `StreamingResponse` generator keeps the contract explicit and under our control.
