-- =====================================================================
-- Gathering Gifts Photos — database schema
-- Run this in the Supabase SQL editor (or via the Supabase CLI).
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- Clients (companies the events belong to) ----------
create table if not exists public.clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  code        text,                       -- short code shown to staff, e.g. "AMH"
  created_at  timestamptz not null default now()
);
create unique index if not exists clients_name_key on public.clients (lower(name));

-- ---------- Tags (fixed taxonomy, seeded below) ----------
create table if not exists public.tags (
  id    serial primary key,
  name  text not null unique
);

insert into public.tags (name) values
  ('food'), ('alcohol'), ('non-alcohol'), ('settlements'), ('others')
on conflict (name) do nothing;

-- ---------- Media (each uploaded photo or video) ----------
create table if not exists public.media (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients(id) on delete cascade,
  uploader_name text not null,            -- free-typed staff name, e.g. "Tom H"
  media_type    text not null check (media_type in ('photo', 'video')),
  r2_key        text not null unique,     -- object key in the R2 bucket
  public_url    text not null,            -- CDN/public URL for display
  content_type  text,
  size_bytes    bigint,
  created_at    timestamptz not null default now()
);
create index if not exists media_client_idx  on public.media (client_id);
create index if not exists media_created_idx on public.media (created_at desc);
create index if not exists media_uploader_idx on public.media (lower(uploader_name));

-- ---------- Media <-> Tags (many-to-many) ----------
create table if not exists public.media_tags (
  media_id  uuid not null references public.media(id) on delete cascade,
  tag_id    int  not null references public.tags(id)  on delete cascade,
  primary key (media_id, tag_id)
);
create index if not exists media_tags_tag_idx on public.media_tags (tag_id);

-- =====================================================================
-- Row Level Security
-- Staff uploads are written server-side with the service role key,
-- which bypasses RLS. Admins read through the auth-aware client.
-- =====================================================================
alter table public.clients     enable row level security;
alter table public.tags        enable row level security;
alter table public.media       enable row level security;
alter table public.media_tags  enable row level security;

-- Anyone (including the public upload page) may read the client list & tags.
drop policy if exists "clients readable" on public.clients;
create policy "clients readable" on public.clients for select using (true);

drop policy if exists "tags readable" on public.tags;
create policy "tags readable" on public.tags for select using (true);

-- Only authenticated admins may read media through the browser/auth client.
drop policy if exists "media admin read" on public.media;
create policy "media admin read" on public.media
  for select using (auth.role() = 'authenticated');

drop policy if exists "media_tags admin read" on public.media_tags;
create policy "media_tags admin read" on public.media_tags
  for select using (auth.role() = 'authenticated');

-- Note: inserts (uploads) and writes happen via the service-role key in API
-- routes, which is exempt from RLS — so no insert policies are required here.

-- =====================================================================
-- Convenience view: media with client name + aggregated tags
-- =====================================================================
create or replace view public.media_view as
select
  m.id,
  m.uploader_name,
  m.media_type,
  m.public_url,
  m.r2_key,
  m.content_type,
  m.size_bytes,
  m.created_at,
  c.id   as client_id,
  c.name as client_name,
  coalesce(
    (select array_agg(t.name order by t.name)
       from public.media_tags mt
       join public.tags t on t.id = mt.tag_id
      where mt.media_id = m.id),
    '{}'
  ) as tags
from public.media m
join public.clients c on c.id = m.client_id;
