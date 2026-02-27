# ADR-001 — Content Tab: Document Upload & Knowledge Extraction

**Status:** DRAFT — pending implementation  
**Date:** 2026-02-26  
**Authors:** Nikos (Architecture Owner)  
**Scope:** Frontend Content Tab → FastAPI → Supabase Storage → Modal Pipeline  
**Relates to:** `ARCHITECTURE.md` § Data Processing Pipeline; job-record / Realtime pattern

---

## 1. Context

The Content tab in the Little Red Writing Room UI is the writer's primary control surface for managing story material. It lists all files the author has uploaded and exposes two actions:

- Add a new file (upload)
- Extract knowledge from a selected file (trigger the processing pipeline)

Neither action is currently wired to the backend. This ADR defines the exact contract between the frontend, the FastAPI backend on Render, Supabase Storage, and the Modal ingestion pipeline — covering both the upload flow and the knowledge extraction flow, including the character-selection step that gates the extraction.

Two pipeline options exist (`baseline` and `advanced`), both sharing the same API contract. The UI sends a `pipeline_option` flag; the backend routes accordingly. This ADR is pipeline-option-agnostic.

---

## 2. Decision Summary

| Decision point | Chosen approach |
|---|---|
| Upload target | Frontend uploads directly to Supabase Storage via a signed URL obtained from FastAPI. Raw bytes never transit Render. |
| Upload metadata record | FastAPI creates a `documents` row in Supabase Postgres immediately after issuing the signed URL (`status: uploaded`). |
| Character selection | After upload, the UI calls `GET /documents/{id}/characters` to retrieve a list of character names extracted by a lightweight pre-scan. The writer selects which characters to focus on before triggering extraction. |
| Extraction trigger | `POST /documents/{id}/process` — FastAPI creates a `processing_jobs` record, then fires a Modal function non-blocking via `.spawn()`. FastAPI returns `job_id` immediately. |
| Progress delivery | Frontend subscribes to the `processing_jobs` row via Supabase Realtime. No polling. Modal updates the row at each pipeline stage. |
| Error handling | Modal always writes a terminal status (`complete` or `failed`). FastAPI exposes `GET /documents/{id}/jobs` so the writer can reconnect to an in-flight job after a page refresh. |
| State ownership | The `DocumentProcessingService` (Modal-side) owns all writes to Supabase and Qdrant. Neither pipeline stages nor LangGraph agents touch state directly. |

---

## 3. Flow A — Document Upload

The upload flow is deliberately thin on the backend. Render is not on the critical path for binary data; Supabase Storage handles the bytes directly from the browser. FastAPI's only roles are authentication, issuing the signed URL, and creating the metadata record.

### 3.1 Step-by-step

| Step | Description |
|---|---|
| 1 | Writer clicks "Add file" in the Content tab and selects a `.md` or `.docx` file. The frontend reads the filename and MIME type but does not begin uploading yet. |
| 2 | Frontend calls `POST /documents/upload-url`, passing `filename`, `mime_type`, and the user's JWT. FastAPI validates the session via Supabase Auth. |
| 3 | FastAPI generates a short-lived signed upload URL via the Supabase Storage SDK and inserts a row into the `documents` table with `status: uploaded`, no chunks yet, no processing job. |
| 4 | FastAPI returns `{ document_id, signed_url }` to the frontend. |
| 5 | Frontend PUTs the file binary directly to the `signed_url`. Supabase Storage receives and stores the raw file. Render is not involved. |
| 6 | On HTTP 200 from Storage, the frontend calls `PATCH /documents/{id}/confirm` to mark the upload as confirmed and trigger a lightweight character name pre-scan (see §3.2). |
| 7 | The Content tab immediately adds the new file to the list with a status badge of "Uploaded — ready to process". |

### 3.2 Sequence diagram

```
Browser         FastAPI (Render)    Supabase Auth    Supabase Storage    Supabase Postgres
   |                  |                   |                  |                   |
   |-- POST /upload-url (JWT, filename) -->|                  |                   |
   |                  |-- verify JWT ----->|                  |                   |
   |                  |<-- user ok --------|                  |                   |
   |                  |-- INSERT documents (status: uploaded) ------------------>|
   |                  |-- generate signed_url ---------------------------->|     |
   |<-- { document_id, signed_url } ---|   |                  |                   |
   |                  |                   |                  |                   |
   |-- PUT file bytes (signed_url) ---------------------------->|                 |
   |<-- HTTP 200 ---------------------------------------------|                 |
   |                  |                   |                  |                   |
   |-- PATCH /documents/{id}/confirm (JWT) -->|               |                   |
   |                  |-- UPDATE documents (status: confirmed) -------------->|
   |                  |-- trigger lightweight name-scan (Modal.spawn) ------>|
   |<-- { status: confirmed, document_id } --|
```

### 3.3 Supabase schema — `documents` table

```sql
create table documents (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users not null,
  filename        text not null,
  mime_type       text not null,
  storage_path    text,          -- set by FastAPI after signed URL issued
  status          text not null  -- uploaded | confirmed | processing | complete | failed
                  default 'uploaded',
  pipeline_option text,          -- baseline | advanced (set at extraction time)
  character_hints jsonb,         -- lightweight name list from pre-scan
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
```

### 3.4 FastAPI endpoints — upload flow

```
POST  /documents/upload-url
  Body:    { filename: str, mime_type: str }
  Auth:    JWT (Supabase)
  Returns: { document_id: uuid, signed_url: str }

PATCH /documents/{document_id}/confirm
  Auth:    JWT (Supabase)
  Returns: { document_id: uuid, status: 'confirmed' }
  Side-effect: fires lightweight Modal name-scan (.spawn)
```

---

## 4. Character Selection — Gating the Extraction

Knowledge extraction is character-scoped. Before triggering the pipeline, the writer selects which characters the system should focus on extracting profiles for. This ensures the advanced pipeline's classification pass (Stage 3) has a `known_characters` list to anchor name resolution, and prevents the system from building profiles for unnamed or incidental characters the writer doesn't care about.

### 4.1 Lightweight name pre-scan

When the writer confirms an upload, FastAPI fires a fast Modal function (`prescan_characters`) that runs independently of the main pipeline. This function:

- Reads the raw file from Supabase Storage
- Runs a single LLM call with a short prompt: `"List all named characters in this text. Return as a JSON array of strings."`
- Writes the result to `documents.character_hints` (a simple JSONB array of strings)
- Updates the document status to `confirmed` (if not already set)

This pre-scan is intentionally cheap — one LLM call, no chunking, no embeddings. Its only purpose is to populate the character picker in the UI.

### 4.2 UI flow — Content tab state machine

| UI state | What the writer sees |
|---|---|
| `uploaded` | File row appears with a spinner badge. Pre-scan is running. |
| `confirmed` | "Extract Knowledge" button becomes active. Character picker populates from `character_hints`. |
| `processing` | Progress bar and stage label replace the Extract button. Realtime-driven. |
| `complete` | Green checkmark. Character profile count shown (e.g. "3 profiles extracted"). |
| `failed` | Red error badge. Error message shown. Option to retry. |

### 4.3 Character picker endpoint

```
GET /documents/{document_id}/characters
  Auth:    JWT (Supabase)
  Returns: { document_id, characters: ["PurpleFrog", "SnowRaven", "OchraMags", ...] }
  Source:  reads documents.character_hints from Postgres
  Note:    returns empty list if pre-scan not yet complete (UI polls
           this endpoint every 3s until non-empty, then stops)
```

> **Note on polling:** this is the one deliberate polling exception in the system. The character list is a one-time read that happens only during the brief window between upload confirm and the writer clicking Extract. A 3-second poll on a single lightweight endpoint is simpler than a Realtime subscription for what is functionally a one-shot read. The frontend stops polling as soon as it receives a non-empty list.

---

## 5. Flow B — Knowledge Extraction

The writer selects one or more characters from the picker and clicks "Extract Knowledge". This triggers the full ingestion pipeline (either `baseline` or `advanced` depending on the `pipeline_option` flag). The document must already be in Supabase Storage and have `status: confirmed`.

### 5.1 Step-by-step

| Step | Description |
|---|---|
| 1 | Writer selects characters and clicks Extract Knowledge. The frontend sends `POST /documents/{id}/process` with `{ selected_characters: [...], pipeline_option: 'advanced' }`. |
| 2 | FastAPI validates the request, checks the document is `confirmed` and not already processing, then inserts a row into `processing_jobs` with `status: pending`. |
| 3 | FastAPI calls `Modal`'s `process_document.spawn(job_id, document_id, user_id, selected_characters, pipeline_option)`. This returns immediately — Render does not block. |
| 4 | FastAPI returns `{ job_id, status: 'pending' }` to the frontend. |
| 5 | Frontend stores `job_id` and opens a Supabase Realtime subscription on the `processing_jobs` row for that `job_id`. |
| 6 | Modal executes the pipeline. The `DocumentProcessingService` updates the job row at each stage (`parsing → chunking → classifying → embedding → storing → complete`). |
| 7 | Each `UPDATE` to `processing_jobs` triggers a Realtime event. The frontend re-renders the progress bar and stage label in real time. |
| 8 | On `status: complete`, the frontend closes the subscription, marks the document as ready, and shows the extracted profile count. |
| 9 | On `status: failed`, the frontend closes the subscription, displays the `error_message`, and shows a Retry button. |

### 5.2 Sequence diagram

```
Browser         FastAPI (Render)    Supabase Postgres    Modal              Qdrant Cloud
   |                  |                    |               |                    |
   |-- POST /documents/{id}/process ------->|               |                    |
   |   { selected_characters, pipeline_option }             |                    |
   |                  |-- INSERT processing_jobs (pending) ->|                    |
   |                  |-- process_document.spawn() -------->|                    |
   |<-- { job_id, status: pending } ------|                 |                    |
   |                  |                    |               |                    |
   |== subscribe Realtime (job_id) =======>|               |                    |
   |                  |                    |               |                    |
   |                  |                    |<-- UPDATE (parsing) --------------|  |
   |<== Realtime event (parsing, 10%) ====|                |                    |
   |                  |                    |<-- UPDATE (chunking) -------------|  |
   |<== Realtime event (chunking, 25%) ===|                |                    |
   |                  |                    |<-- UPDATE (classifying) ----------|  |
   |<== Realtime event (classifying, 45%) =|               |                    |
   |                  |                    |<-- UPDATE (embedding, N%) --------|  |
   |<== Realtime event (embedding, 70–95%) =|              |                    |
   |                  |                    |               |-- upsert chunks -->|
   |                  |                    |<-- UPDATE (complete, 100%) -------|  |
   |<== Realtime event (complete) ========|                |                    |
   |== unsubscribe ========================|               |                    |
```

### 5.3 FastAPI endpoints — extraction

```
POST /documents/{document_id}/process
  Auth:    JWT (Supabase)
  Body: {
    selected_characters: list[str],   -- from character picker; passed to Modal
    pipeline_option: 'baseline' | 'advanced'
  }
  Guards:
    - document.status must be 'confirmed'
    - no existing processing_jobs row with status IN ('pending', 'parsing',
      'chunking', 'classifying', 'embedding', 'storing')
  Returns: { job_id: uuid, status: 'pending' }

GET /documents/{document_id}/jobs
  Auth:    JWT (Supabase)
  Returns: latest processing_jobs row for this document
  Purpose: reconnect to in-flight job after page refresh
```

### 5.4 Supabase schema — `processing_jobs` table

```sql
create table processing_jobs (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references auth.users not null,
  document_id         uuid references documents not null,
  status              text not null default 'pending',
  -- pending | parsing | chunking | classifying
  -- | embedding | storing | complete | failed
  pipeline_option     text not null,
  selected_characters jsonb,         -- writer's selection from picker
  progress_pct        integer default 0,
  current_stage       text,
  error_message       text,
  chunks_total        integer,
  chunks_processed    integer default 0,
  profiles_extracted  integer default 0,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- Enable Realtime on this table in the Supabase dashboard (public schema)
```

### 5.5 Modal pipeline — job update checkpoints

The `DocumentProcessingService` calls `update_job()` at each stage transition. Each call is a single Postgres `UPDATE` that triggers a Realtime broadcast. For long embedding loops, `progress_pct` increments every 10 chunks to avoid excessive write load.

| Stage | `status` value | `progress_pct` |
|---|---|---|
| Pipeline starts | `parsing` | 10% |
| Chunks computed | `chunking` | 25% |
| LLM classify done (advanced only) | `classifying` | 45% |
| Embedding loop start | `embedding` | 70% |
| Embedding loop (per batch) | `embedding` | 70–95% (incremental) |
| Qdrant + Supabase writes | `storing` | 95% |
| All done | `complete` | 100% |
| Any unhandled exception | `failed` | — |

---

## 6. Error Handling & Edge Cases

| Scenario | Handling |
|---|---|
| Modal times out mid-pipeline | The Modal function has a 600s hard timeout. The `try/except` block in `process_document` always writes `status: failed` with a descriptive `error_message` before re-raising. The job never gets stuck in a non-terminal state. |
| Writer closes tab mid-processing | The pipeline continues unaffected — it has no connection to the browser. On return, the frontend calls `GET /documents/{id}/jobs`, retrieves the current `job_id` and `status`, and re-subscribes to Realtime if the job is still in flight. |
| Duplicate extraction request | FastAPI guards the `POST /process` endpoint: if an active job already exists for the document, it returns `409 Conflict` with the existing `job_id`. The frontend can subscribe to that job's Realtime channel instead. |
| Upload signed URL expires before PUT | Signed URLs have a 10-minute TTL. If the PUT fails with 403, the frontend calls `POST /upload-url` again. The `documents` row (already inserted) is updated with the new `storage_path`. |
| Pre-scan LLM call fails | `character_hints` remains null. The character picker shows a manual text entry field as a fallback. The writer types character names. Extraction proceeds normally. |
| File format not supported | FastAPI validates `mime_type` in the `/upload-url` handler. Only `text/markdown`, `application/octet-stream` (for `.md`), and `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (`.docx`) are accepted. Rejection is immediate, before any Storage write. |

---

## 7. Frontend Wiring Checklist

Ordered by dependency. Implement in this sequence.

### 7.1 Upload flow

- [ ] "Add file" button → call `POST /documents/upload-url`
- [ ] PUT file bytes to returned `signed_url` using browser `fetch` (not axios — no interceptors on Storage calls)
- [ ] On 200 → call `PATCH /documents/{id}/confirm`
- [ ] Append new document row to local list state with `status: uploaded`
- [ ] Poll `GET /documents/{id}/characters` every 3s until non-empty, then stop and update UI state to `confirmed`

### 7.2 Character picker

- [ ] Render character name chips/checkboxes from the `characters` array
- [ ] Allow multi-select; at least one character must be selected to enable Extract
- [ ] Include a manual text entry field as fallback when `character_hints` is null

### 7.3 Extraction flow

- [ ] "Extract Knowledge" button → call `POST /documents/{id}/process` with `selected_characters` and `pipeline_option`
- [ ] Store returned `job_id` in component state or URL param so it survives a refresh
- [ ] Open Supabase Realtime subscription on `processing_jobs` row filtered by `job_id`
- [ ] Map `status` values to progress bar percentage and stage label (use the table in §5.5)
- [ ] On `complete` → close subscription, update document card to show profile count
- [ ] On `failed` → close subscription, show `error_message`, show Retry button (fires `POST /process` again)
- [ ] On mount, call `GET /documents/{id}/jobs` for any document with a non-terminal status to recover in-flight jobs

---

## 8. Open Questions

| Question | Notes |
|---|---|
| Should `pipeline_option` be user-selectable in the UI, or fixed per environment? | Currently the architecture uses a feature flag. For the cert demo, defaulting to `advanced` and hiding the toggle keeps the UI cleaner. Revisit for Phase 2. |
| Should `selected_characters` scope retrieval at query time, or just at ingestion time? | For Phase 1, scoping is ingestion-only — profiles are extracted for selected characters, but the retrieval tool searches all characters' chunks. Per-character scoping at query time (via Qdrant metadata filters) is already designed in Option B; the UI would need a character filter control in the chat panel. |
| Should the pre-scan run before or in parallel with signed URL generation? | Currently the pre-scan fires after `/confirm`, which is after the upload completes. There is a latency window between upload and character picker being ready. If this feels slow in practice, the pre-scan could be fired from a Storage webhook instead. |
| What happens if the writer re-processes a document they already processed? | Currently undefined. Options: (a) upsert — re-run the pipeline and overwrite existing vectors keyed by `document_id`; (b) versioning — keep old vectors and create a new version record. Recommend upsert for the demo; versioning for Phase N. |

---

## 9. Consequences

### Positive

- Render is never on the critical path for binary data — upload throughput is bounded only by Supabase Storage, not the API server.
- FastAPI returns immediately on both `/upload-url` and `/process` — no long-held HTTP connections, no Render timeout risk for multi-minute pipelines.
- Realtime push means the UI is always consistent with pipeline state without polling overhead.
- The `DocumentProcessingService` as the single state-writer keeps the pipeline stages pure and testable in isolation.
- The character selection step ensures the advanced pipeline's `known_characters` anchor is populated from the writer's own choices, reducing hallucinated name resolution.

### Negative / Trade-offs

- Two-hop upload (get signed URL, then PUT) adds one round-trip versus a direct multipart POST to the backend. Acceptable given the throughput benefit.
- The 3-second poll on `/characters` is a deliberate exception to the no-polling rule. It is bounded — it stops on first non-empty response — and simpler than a Realtime subscription for a one-shot read.
- If Supabase Realtime is unavailable, the writer sees no pipeline progress. A fallback polling mode on `processing_jobs` should be added before production.
- The pre-scan LLM call adds latency between upload confirm and the Extract button becoming active. If this is perceptible, the character picker manual fallback entry must be clearly surfaced.
