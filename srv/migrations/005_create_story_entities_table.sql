-- Migration 005: Unified story_entities table + extraction tracking
--
-- Replaces the separate characters and locations tables with a single
-- polymorphic table. Existing data is copied (not moved) so the old
-- tables remain intact until manually dropped.

create table
  story_entities (
    id uuid primary key default gen_random_uuid (),
    user_id uuid not null references auth.users (id) on delete cascade,
    entity_type text not null,
    name text not null,
    initials text not null,
    color text not null,
    created_at timestamptz not null default now (),
    unique (user_id, entity_type, name)
  );

alter table story_entities enable row level security;

create policy "owner access" on story_entities using (user_id = auth.uid ());

-- Migrate existing data
insert into
  story_entities (id, user_id, entity_type, name, initials, color, created_at)
select
  id,
  user_id,
  'character',
  name,
  initials,
  color,
  created_at
from
  characters;

insert into
  story_entities (id, user_id, entity_type, name, initials, color, created_at)
select
  id,
  user_id,
  'location',
  name,
  initials,
  color,
  created_at
from
  locations;

-- Tracks which entities have been extracted from which documents.
-- document_id is plain text (not a FK) because documents may live in
-- InMemoryDocumentStore (local mode) or the Supabase documents table.
create table
  document_entity_extractions (
    document_id text not null,
    entity_id uuid not null references story_entities (id) on delete cascade,
    user_id uuid not null references auth.users (id) on delete cascade,
    extracted_at timestamptz not null default now (),
    primary key (document_id, entity_id)
  );

alter table document_entity_extractions enable row level security;

create policy "owner access" on document_entity_extractions using (user_id = auth.uid ());
