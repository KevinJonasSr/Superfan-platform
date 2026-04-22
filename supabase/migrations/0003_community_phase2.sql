-- ────────────────────────────────────────────────────────────────────────────
-- Fan Engage — Community Hub Phase 2a (polls, challenges, announcements)
-- Safe to re-run (idempotent).
-- Apply via: Supabase dashboard → SQL Editor → paste → Run.
-- ────────────────────────────────────────────────────────────────────────────

-- NOTE: community_post_kind enum already includes 'post', 'announcement',
-- 'poll', 'challenge' (added in 0002). No enum alteration needed.

-- ─── Poll options (per poll post) ──────────────────────────────────────────
create table if not exists public.community_poll_options (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.community_posts(id) on delete cascade,
  label       text not null,
  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists community_poll_options_post_idx
  on public.community_poll_options (post_id, sort_order);

-- ─── Poll votes (one vote per fan per poll) ────────────────────────────────
create table if not exists public.community_poll_votes (
  post_id     uuid not null references public.community_posts(id) on delete cascade,
  fan_id      uuid not null references public.fans(id) on delete cascade,
  option_id   uuid not null references public.community_poll_options(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (post_id, fan_id)
);

create index if not exists community_poll_votes_option_idx
  on public.community_poll_votes (option_id);

-- ─── Challenge entries (fan submissions to a challenge post) ───────────────
create table if not exists public.community_challenge_entries (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.community_posts(id) on delete cascade,
  fan_id      uuid not null references public.fans(id) on delete cascade,
  body        text,
  image_url   text,
  created_at  timestamptz not null default now()
);

-- One entry per fan per challenge — can be relaxed later if we want multiple.
create unique index if not exists community_challenge_entries_unique
  on public.community_challenge_entries (post_id, fan_id);
create index if not exists community_challenge_entries_post_idx
  on public.community_challenge_entries (post_id, created_at desc);

-- ─── Points triggers (+1 pt poll vote, +3 pts challenge entry) ─────────────
create or replace function public.award_poll_vote_points()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  award int := 1;
  ref_id text := 'poll_vote:' || new.post_id::text || ':' || new.fan_id::text;
begin
  if not exists (select 1 from points_ledger where source_ref = ref_id) then
    insert into points_ledger (fan_id, delta, source, source_ref, note)
    values (new.fan_id, award, 'challenge', ref_id, 'Poll vote');

    update fans
    set total_points = coalesce(total_points, 0) + award
    where id = new.fan_id;
  end if;
  return new;
end $$;

drop trigger if exists community_poll_votes_award_points on public.community_poll_votes;
create trigger community_poll_votes_award_points
  after insert on public.community_poll_votes
  for each row execute function public.award_poll_vote_points();

create or replace function public.award_challenge_entry_points()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  award int := 3;
  ref_id text := 'challenge_entry:' || new.id::text;
begin
  if not exists (select 1 from points_ledger where source_ref = ref_id) then
    insert into points_ledger (fan_id, delta, source, source_ref, note)
    values (new.fan_id, award, 'challenge', ref_id, 'Challenge submission');

    update fans
    set total_points = coalesce(total_points, 0) + award
    where id = new.fan_id;
  end if;
  return new;
end $$;

drop trigger if exists community_challenge_entries_award_points on public.community_challenge_entries;
create trigger community_challenge_entries_award_points
  after insert on public.community_challenge_entries
  for each row execute function public.award_challenge_entry_points();

-- ─── Row Level Security ────────────────────────────────────────────────────
alter table public.community_poll_options       enable row level security;
alter table public.community_poll_votes         enable row level security;
alter table public.community_challenge_entries  enable row level security;

-- Poll options: authenticated read; writes only through service role (admin)
-- since only admins create polls in Phase 2a. No insert/update/delete policy
-- for regular users — they can't create options directly.
drop policy if exists community_poll_options_select on public.community_poll_options;
create policy community_poll_options_select on public.community_poll_options
  for select using (auth.role() = 'authenticated');

-- Poll votes: authenticated read, each fan can only vote as themselves.
drop policy if exists community_poll_votes_select on public.community_poll_votes;
create policy community_poll_votes_select on public.community_poll_votes
  for select using (auth.role() = 'authenticated');

drop policy if exists community_poll_votes_insert on public.community_poll_votes;
create policy community_poll_votes_insert on public.community_poll_votes
  for insert with check (auth.uid() = fan_id);

drop policy if exists community_poll_votes_delete on public.community_poll_votes;
create policy community_poll_votes_delete on public.community_poll_votes
  for delete using (auth.uid() = fan_id);

-- Challenge entries: authenticated read, fans can submit + withdraw their own.
drop policy if exists community_challenge_entries_select on public.community_challenge_entries;
create policy community_challenge_entries_select on public.community_challenge_entries
  for select using (auth.role() = 'authenticated');

drop policy if exists community_challenge_entries_insert on public.community_challenge_entries;
create policy community_challenge_entries_insert on public.community_challenge_entries
  for insert with check (auth.uid() = fan_id);

drop policy if exists community_challenge_entries_delete on public.community_challenge_entries;
create policy community_challenge_entries_delete on public.community_challenge_entries
  for delete using (auth.uid() = fan_id);

-- ─── Smoke test ────────────────────────────────────────────────────────────
-- select table_name from information_schema.tables
-- where table_schema = 'public' and table_name like 'community_%'
-- order by table_name;
-- Expect: community_challenge_entries, community_comments, community_poll_options,
--         community_poll_votes, community_posts, community_reactions
