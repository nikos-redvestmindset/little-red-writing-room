-- Migration 002: Characters table for per-user character persistence
-- Apply via Supabase SQL Editor or `supabase db push`
create table
  characters (
    id uuid primary key default gen_random_uuid (),
    user_id uuid not null references auth.users (id) on delete cascade,
    name text not null,
    initials text not null,
    color text not null,
    created_at timestamptz not null default now ()
  );

alter table characters enable row level security;

create policy "owner access" on characters using (user_id = auth.uid ());