-- ────────────────────────────────────────────────────────────────────────────
-- Fan Engage — Community Hub MVP (posts, reactions, comments)
-- Safe to re-run (idempotent).
-- Apply via: Supabase dashboard → SQL Editor → paste → Run.
-- ────────────────────────────────────────────────────────────────────────────

-- ─── Enum for post kind (extensible for Phase 2) ───────────────────────────
do $$ begin
  create type community_post_kind as enum ('post', 'announcement', 'poll', 'challenge');
exception when duplicate_object then null; end $$;

-- ─── Community posts (one feed per artist) ─────────────────────────────────
create table if not exists public.community_posts (
  id           uuid primary key default gen_random_uuid(),
  artist_slug  text not null,
  author_id    uuid not null references public.fans(id) on delete cascade,
  kind         community_post_kind not null default 'post',
  title        text,
  body         text not null,
  image_url    text,
  pinned       boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists community_posts_artist_idx
  on public.community_posts (artist_slug, pinned desc, created_at desc);
create index if not exists community_posts_author_idx
  on public.community_posts (author_id);

-- ─── Reactions (emoji per (post, fan)) ─────────────────────────────────────
create table if not exists public.community_reactions (
  post_id     uuid not null references public.community_posts(id) on delete cascade,
  fan_id      uuid not null references public.fans(id) on delete cascade,
  emoji       text not null,
  created_at  timestamptz not null default now(),
  primary key (post_id, fan_id, emoji)
);

create index if not exists community_reactions_post_idx
  on public.community_reactions (post_id);

-- ─── Comments (flat for MVP) ───────────────────────────────────────────────
create table if not exists public.community_comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.community_posts(id) on delete cascade,
  author_id   uuid not null references public.fans(id) on delete cascade,
  body        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists community_comments_post_idx
  on public.community_comments (post_id, created_at asc);

-- ─── Points trigger helpers ─────────────────────────────────────────────────
-- +5 pts on community post, +2 pts on community comment. Idempotent via
-- source_ref — if the same row ever re-runs (unlikely since IDs are uuids),
-- we won't double-award.
--
-- Using source='challenge' because the 0001_init.sql enum doesn't have a
-- 'community' value and ALTER TYPE needs its own migration.

create or replace function public.award_community_post_points()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  award int := 5;
  ref_id text := 'community_post:' || new.id::text;
begin
  if not exists (select 1 from points_ledger where source_ref = ref_id) then
    insert into points_ledger (fan_id, delta, source, source_ref, note)
    values (new.author_id, award, 'challenge', ref_id, 'Community post');

    update fans
    set total_points = coalesce(total_points, 0) + award
    where id = new.author_id;
  end if;
  return new;
end $$;

drop trigger if exists community_posts_award_points on public.community_posts;
create trigger community_posts_award_points
  after insert on public.community_posts
  for each row execute function public.award_community_post_points();

create or replace function public.award_community_comment_points()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  award int := 2;
  ref_id text := 'community_comment:' || new.id::text;
begin
  if not exists (select 1 from points_ledger where source_ref = ref_id) then
    insert into points_ledger (fan_id, delta, source, source_ref, note)
    values (new.author_id, award, 'challenge', ref_id, 'Community comment');

    update fans
    set total_points = coalesce(total_points, 0) + award
    where id = new.author_id;
  end if;
  return new;
end $$;

drop trigger if exists community_comments_award_points on public.community_comments;
create trigger community_comments_award_points
  after insert on public.community_comments
  for each row execute function public.award_community_comment_points();

-- ─── Row Level Security ────────────────────────────────────────────────────
alter table public.community_posts     enable row level security;
alter table public.community_reactions enable row level security;
alter table public.community_comments  enable row level security;

-- Posts: everyone signed in reads; authors manage their own.
drop policy if exists community_posts_select on public.community_posts;
create policy community_posts_select on public.community_posts
  for select using (auth.role() = 'authenticated');

drop policy if exists community_posts_insert on public.community_posts;
create policy community_posts_insert on public.community_posts
  for insert with check (auth.uid() = author_id);

drop policy if exists community_posts_update on public.community_posts;
create policy community_posts_update on public.community_posts
  for update using (auth.uid() = author_id);

drop policy if exists community_posts_delete on public.community_posts;
create policy community_posts_delete on public.community_posts
  for delete using (auth.uid() = author_id);

-- Reactions: authenticated read, authors toggle their own.
drop policy if exists community_reactions_select on public.community_reactions;
create policy community_reactions_select on public.community_reactions
  for select using (auth.role() = 'authenticated');

drop policy if exists community_reactions_insert on public.community_reactions;
create policy community_reactions_insert on public.community_reactions
  for insert with check (auth.uid() = fan_id);

drop policy if exists community_reactions_delete on public.community_reactions;
create policy community_reactions_delete on public.community_reactions
  for delete using (auth.uid() = fan_id);

-- Comments: authenticated read, authors manage their own.
drop policy if exists community_comments_select on public.community_comments;
create policy community_comments_select on public.community_comments
  for select using (auth.role() = 'authenticated');

drop policy if exists community_comments_insert on public.community_comments;
create policy community_comments_insert on public.community_comments
  for insert with check (auth.uid() = author_id);

drop policy if exists community_comments_delete on public.community_comments;
create policy community_comments_delete on public.community_comments
  for delete using (auth.uid() = author_id);

-- Admin writes (pin, delete-any, feature) flow through the service-role
-- client which bypasses RLS — no separate admin policy needed.

-- ─── Smoke test query to confirm schema applied ────────────────────────────
-- select table_name from information_schema.tables
-- where table_schema = 'public' and table_name like 'community_%'
-- order by table_name;
