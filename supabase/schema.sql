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

-- Dedicated Supabase Storage bucket for photos, invoices, and equipment manual PDFs
insert into storage.buckets (id, name, public)
values ('captains-media', 'captains-media', false)
on conflict (id) do nothing;

drop policy if exists "Allow anon read/write captains-media" on storage.objects;

create policy "Allow anon read/write captains-media"
  on storage.objects
  for all
  to anon, authenticated
  using (bucket_id = 'captains-media')
  with check (bucket_id = 'captains-media');

