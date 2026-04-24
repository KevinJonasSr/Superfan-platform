-- ─── Community video storage and schema ──────────────────────────────────
-- Migration 0022: Add video_url and video_poster_url to community_posts,
-- create community-videos bucket with 50 MB limit, and set up RLS policies.

-- Add video columns to community_posts (idempotent)
alter table public.community_posts
  add column if not exists video_url text,
  add column if not exists video_poster_url text;

-- Create storage bucket for community videos (idempotent)
insert into storage.buckets (id, name, public, file_size_limit)
values ('community-videos', 'community-videos', true, 52428800)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

-- Public read policy for community-videos
drop policy if exists community_videos_public_read on storage.objects;
create policy community_videos_public_read on storage.objects
  for select using (bucket_id = 'community-videos');

-- Authenticated insert to own folder only (path prefix must be auth.uid())
drop policy if exists community_videos_insert_own on storage.objects;
create policy community_videos_insert_own on storage.objects
  for insert with check (
    bucket_id = 'community-videos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated update/delete only own objects
drop policy if exists community_videos_update_own on storage.objects;
create policy community_videos_update_own on storage.objects
  for update using (
    bucket_id = 'community-videos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists community_videos_delete_own on storage.objects;
create policy community_videos_delete_own on storage.objects
  for delete using (
    bucket_id = 'community-videos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
