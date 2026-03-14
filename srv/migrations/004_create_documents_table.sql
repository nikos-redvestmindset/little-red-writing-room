-- Migration 004: Documents table for per-user document metadata persistence
create table
  documents (
    id uuid primary key default gen_random_uuid (),
    user_id uuid not null references auth.users (id) on delete cascade,
    filename text not null,
    mime_type text not null,
    size integer not null default 0,
    storage_path text,
    status text not null default 'uploaded',
    pipeline_option text,
    chunks_stored integer not null default 0,
    error_message text,
    created_at timestamptz not null default now (),
    updated_at timestamptz not null default now ()
  );

alter table documents enable row level security;

create policy "owner access" on documents using (user_id = auth.uid ());
