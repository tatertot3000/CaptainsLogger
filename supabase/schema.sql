-- Run this once in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- to create the cloud sync table for Captain's Logger.

create table if not exists public.captains_log_sync (
  boat_id text primary key,
  vessel_name text not null,
  updated_at timestamptz not null default now(),
  payload jsonb not null
);

alter table public.captains_log_sync enable row level security;

drop policy if exists "Allow anon read/write by boat_id" on public.captains_log_sync;

create policy "Allow anon read/write by boat_id"
  on public.captains_log_sync
  for all
  to anon, authenticated
  using (true)
  with check (true);

