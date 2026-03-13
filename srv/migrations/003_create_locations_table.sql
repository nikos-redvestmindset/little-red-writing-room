-- Migration 003: Locations table for per-user location persistence
create table
  locations (
    id uuid primary key default gen_random_uuid (),
    user_id uuid not null references auth.users (id) on delete cascade,
    name text not null,
    initials text not null,
    color text not null,
    created_at timestamptz not null default now ()
  );

alter table locations enable row level security;

create policy "owner access" on locations using (user_id = auth.uid ());
