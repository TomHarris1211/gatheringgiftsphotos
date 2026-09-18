-- =====================================================================
-- Gathering Gifts Photos — capture date
-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- Adds media.taken_at (the date read from the photo's EXIF data) and
-- exposes captured_at = coalesce(taken_at, created_at) on media_view so
-- the dashboard can sort and filter on "when it was taken" while older
-- rows keep working off their upload time.
-- =====================================================================

alter table public.media
  add column if not exists taken_at timestamptz;

comment on column public.media.taken_at is
  'Capture date read from the photo EXIF at upload time. Null for videos and images with no EXIF.';

-- Index the effective date so ordering stays fast as the library grows.
create index if not exists media_captured_idx
  on public.media ((coalesce(taken_at, created_at)) desc);

-- Rebuild the view with the two new columns appended at the end
-- (appending keeps "create or replace" legal — reordering would not).
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
  ) as tags,
  m.taken_at,
  coalesce(m.taken_at, m.created_at) as captured_at
from public.media m
join public.clients c on c.id = m.client_id;
