-- Migration 006: Processing jobs table for cross-process progress tracking
--               + note column on document_entity_extractions

-- ── processing_jobs ──────────────────────────────────────────────────────────
-- One row per document extraction run, upserted at each pipeline stage.
-- Used by SupabaseProgressNotifier to relay progress from Modal → FastAPI
-- via pg_notify.

create table
  processing_jobs (
    id uuid primary key default gen_random_uuid (),
    document_id uuid not null references documents (id) on delete cascade unique,
    user_id uuid not null references auth.users (id) on delete cascade,
    current_stage text not null default 'pending',
    progress_pct integer not null default 0,
    chunks_total integer,
    chunks_processed integer,
    message text not null default '',
    created_at timestamptz not null default now (),
    updated_at timestamptz not null default now ()
  );

alter table processing_jobs enable row level security;

create policy "owner access" on processing_jobs using (user_id = auth.uid ());

-- Trigger: fire pg_notify on every insert/update so asyncpg LISTEN picks it up.
create or replace function notify_document_progress ()
  returns trigger
  as $$
begin
  perform pg_notify(
    'doc_progress_' || NEW.document_id::text,
    json_build_object(
      'stage', NEW.current_stage,
      'progress_pct', NEW.progress_pct,
      'chunks_total', NEW.chunks_total,
      'chunks_processed', NEW.chunks_processed,
      'message', NEW.message
    )::text
  );
  NEW.updated_at := now();
  return NEW;
end;
$$ language plpgsql;

create trigger processing_jobs_notify
  before insert or update on processing_jobs
  for each row
  execute function notify_document_progress ();

-- ── document_entity_extractions: add note column ─────────────────────────────
-- Human-readable one-liner, e.g. "PurpleFrog, SnowRaven from chapter1.md"
alter table document_entity_extractions
  add column note text not null default '';
