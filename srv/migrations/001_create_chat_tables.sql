-- Migration 001: Chat tables for ADR-002 Frontend-Backend Chat Integration
-- Apply via Supabase SQL Editor or `supabase db push`

-- ── Enum ──────────────────────────────────────────────────────────────────────

create type message_role as enum ('user', 'assistant');

-- ── chats ─────────────────────────────────────────────────────────────────────

create table chats (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  character_id  text not null,
  title         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table chats enable row level security;

create policy "owner access" on chats
  using (user_id = auth.uid());

-- ── messages ──────────────────────────────────────────────────────────────────

create table messages (
  id          uuid primary key default gen_random_uuid(),
  chat_id     uuid not null references chats(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        message_role not null,
  content     text not null,
  citations   jsonb,
  gap_flags   jsonb,
  created_at  timestamptz not null default now()
);

alter table messages enable row level security;

create policy "owner access" on messages
  using (
    exists (
      select 1 from chats
      where chats.id = messages.chat_id
        and chats.user_id = auth.uid()
    )
  );

-- ── narrative_state ───────────────────────────────────────────────────────────

create table narrative_state (
  chat_id     uuid primary key references chats(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  state       jsonb not null default '{}',
  updated_at  timestamptz not null default now()
);

alter table narrative_state enable row level security;

create policy "owner access" on narrative_state
  using (user_id = auth.uid());

-- ── Trigger: bump chats.updated_at on new message ────────────────────────────

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
