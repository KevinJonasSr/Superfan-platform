-- ────────────────────────────────────────────────────────────────────────────
-- Fan Engage — Phase 4a: multi-tenant foundation
--
-- Creates `communities` (tenants), `fan_community_memberships` (per-community
-- points/tier/referral), and `admin_users` (per-community admin scoping).
-- Adds `community_id` to every scoped table and backfills with 'raelynn'
-- since that's our only live tenant.
--
-- DESIGN PRINCIPLE: additive only. Existing application code keeps working.
-- New columns get a default of 'raelynn' so existing INSERT paths that don't
-- yet specify community_id land in the correct tenant. Phase 4b/4c will
-- refactor those paths; a later migration will drop the default.
--
-- Safe to re-run (idempotent). Runs inside Supabase's implicit transaction
-- so a failure anywhere rolls back the whole migration.
--
-- Apply via: Supabase dashboard → SQL Editor → paste → Run.
-- ────────────────────────────────────────────────────────────────────────────


-- ─── 1. communities table ─────────────────────────────────────────────────
-- One row per tenant. `type` partitions artist communities from label-meta
-- (Jonas Group Street Team) and brand loyalty (Nellie's). `subdomain` drives
-- per-tenant URL routing (set up in Phase 4b middleware).

create table if not exists public.communities (
  slug            text primary key,
  display_name    text not null,
  type            text not null check (type in ('artist','label_meta','brand')),
  tagline         text,
  bio             text,
  accent_from     text not null default '#7c3aed',
  accent_to       text not null default '#fb923c',
  hero_image      text,
  logo_url        text,
  subdomain       text unique,
  active          boolean not null default true,
  sort_order      smallint not null default 0,
  created_at      timestamptz not null default now()
);

-- Seed the 6 launch communities. Only `raelynn` starts active; the rest
-- flip to active when their content + admin setup is ready.
insert into public.communities (slug, display_name, type, tagline, subdomain, active, sort_order) values
  ('raelynn',         'RaeLynn',                      'artist',     'Country, heart-first.',     'raelynn',      true,  1),
  ('danger-twins',    'Danger Twins · Amy Stroup',    'artist',     null,                        'dangertwins',  false, 2),
  ('dan-marshall',    'Dan Marshall',                 'artist',     null,                        'danmarshall',  false, 3),
  ('hunter-hawkins',  'Hunter Hawkins',               'artist',     null,                        'hunterhawkins',false, 4),
  ('street-team',     'Jonas Group Street Team',      'label_meta', null,                        'streetteam',   false, 5),
  ('nellies',         'Nellie''s Southern Kitchen',   'brand',      null,                        'nellies',      false, 6)
on conflict (slug) do update set
  display_name = excluded.display_name,
  type         = excluded.type,
  subdomain    = excluded.subdomain,
  sort_order   = excluded.sort_order;


-- ─── 2. fan_community_memberships ─────────────────────────────────────────
-- Per-community fan state. A fan who belongs to N communities has N rows
-- here, each with its own points balance, tier, and referral_code. This
-- is the table that makes per-community loyalty economies work.

create table if not exists public.fan_community_memberships (
  fan_id          uuid references public.fans(id) on delete cascade,
  community_id    text references public.communities(slug) on delete cascade,
  joined_at       timestamptz not null default now(),
  total_points    integer not null default 0,
  current_tier    tier_slug not null default 'bronze',
  referral_code   text unique,
  status          text not null default 'active' check (status in ('active','suspended','pending')),
  primary key (fan_id, community_id)
);

create index if not exists fan_community_memberships_fan_idx
  on public.fan_community_memberships (fan_id);
create index if not exists fan_community_memberships_community_idx
  on public.fan_community_memberships (community_id, status);

-- Backfill: every existing fan becomes a RaeLynn community member with
-- their current points/tier copied in. Only tenant today is RaeLynn, so
-- this is the right mapping. Idempotent via the composite PK.
insert into public.fan_community_memberships
  (fan_id, community_id, joined_at, total_points, current_tier, referral_code, status)
select
  id,
  'raelynn',
  coalesce(created_at, now()),
  coalesce(total_points, 0),
  coalesce(current_tier, 'bronze'),
  referral_code,
  case when suspended_at is not null then 'suspended' else 'active' end
from public.fans
on conflict (fan_id, community_id) do nothing;


-- ─── 3. admin_users ───────────────────────────────────────────────────────
-- Per-community admin roster. Replaces the ADMIN_EMAILS env allowlist.
-- community_id = '*' marks a super-admin (can access every community).
-- Seed rows for existing ADMIN_EMAILS are NOT added here — they need to
-- be inserted manually once the migration runs, because Postgres can't
-- read process env. See the smoke-test section for the lookup query.

create table if not exists public.admin_users (
  user_id         uuid not null references public.fans(id) on delete cascade,
  community_id    text not null,
  role            text not null default 'admin' check (role in ('owner','admin','editor','viewer')),
  created_at      timestamptz not null default now(),
  primary key (user_id, community_id)
);


-- ─── 4. Helpers: is_admin_of / is_member_of ───────────────────────────────
-- These are called from RLS policies across the platform. Keeping the
-- check logic in one place makes policy code short and consistent.

create or replace function public.is_admin_of(p_community_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from admin_users
    where user_id = auth.uid()
      and (community_id = p_community_id or community_id = '*')
  );
$$;

create or replace function public.is_member_of(p_community_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from fan_community_memberships
    where fan_id = auth.uid()
      and community_id = p_community_id
      and status = 'active'
  );
$$;


-- ─── 5. Add community_id to every scoped table ────────────────────────────
-- Additive only. Default 'raelynn' so existing INSERT paths that don't yet
-- pass community_id still produce valid rows (correct for today since
-- RaeLynn is the only active tenant). Phase 4b/4c will make the column
-- a required argument in application code; a later migration will drop
-- the default.

-- community_posts: already has artist_slug. Copy to community_id.
alter table public.community_posts add column if not exists community_id text not null default 'raelynn';
update public.community_posts set community_id = artist_slug where artist_slug is not null and community_id = 'raelynn';
create index if not exists community_posts_community_idx
  on public.community_posts (community_id, created_at desc);

-- artist_events: same pattern. (Table stays named artist_events for now; a
-- later migration may rename to `events` once all callers are updated.)
alter table public.artist_events add column if not exists community_id text not null default 'raelynn';
update public.artist_events set community_id = artist_slug where artist_slug is not null and community_id = 'raelynn';
create index if not exists artist_events_community_idx
  on public.artist_events (community_id, starts_at);

-- campaigns
alter table public.campaigns add column if not exists community_id text not null default 'raelynn';
update public.campaigns set community_id = artist_slug where artist_slug is not null and community_id = 'raelynn';

-- fan_actions (CTAs)
alter table public.fan_actions add column if not exists community_id text not null default 'raelynn';
update public.fan_actions set community_id = artist_slug where artist_slug is not null and community_id = 'raelynn';

-- fan_action_completions: no artist_slug today. Inherit from action row.
alter table public.fan_action_completions add column if not exists community_id text not null default 'raelynn';
update public.fan_action_completions c
  set community_id = a.community_id
  from public.fan_actions a
  where c.action_id = a.id and c.community_id = 'raelynn' and a.community_id <> 'raelynn';

-- offers: no per-artist scoping today — future launches will have per-community catalogs.
alter table public.offers add column if not exists community_id text not null default 'raelynn';

-- purchases: inherit from the offer.
alter table public.purchases add column if not exists community_id text not null default 'raelynn';
update public.purchases p
  set community_id = o.community_id
  from public.offers o
  where p.offer_id = o.id and p.community_id = 'raelynn' and o.community_id <> 'raelynn';

-- referrals: per-community membership, since referral_code lives per membership.
alter table public.referrals add column if not exists community_id text not null default 'raelynn';

-- points_ledger: scope every ledger entry to a community.
alter table public.points_ledger add column if not exists community_id text not null default 'raelynn';
create index if not exists points_ledger_community_fan_idx
  on public.points_ledger (community_id, fan_id, created_at desc);

-- notifications: already indexed by fan_id; add community for future filtering.
alter table public.notifications add column if not exists community_id text not null default 'raelynn';

-- fan_badges: a fan can earn the same badge in multiple communities.
-- The current PK (fan_id, badge_slug) blocks multi-community earns — we
-- widen it to (fan_id, badge_slug, community_id) so e.g. "Welcome" can
-- be earned once per community.
alter table public.fan_badges add column if not exists community_id text not null default 'raelynn';
-- Only drop-and-recreate the PK if it's the old 2-column shape. Idempotent guard:
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'fan_badges'
      and constraint_type = 'PRIMARY KEY'
      and constraint_name = 'fan_badges_pkey'
  ) and not exists (
    select 1 from information_schema.key_column_usage
    where table_schema = 'public' and table_name = 'fan_badges'
      and constraint_name = 'fan_badges_pkey'
      and column_name = 'community_id'
  ) then
    alter table public.fan_badges drop constraint fan_badges_pkey;
    alter table public.fan_badges add primary key (fan_id, badge_slug, community_id);
  end if;
end $$;

-- event_rsvps: denormalize from the event's community.
alter table public.event_rsvps add column if not exists community_id text not null default 'raelynn';
update public.event_rsvps r
  set community_id = e.community_id
  from public.artist_events e
  where r.event_id = e.id and r.community_id = 'raelynn' and e.community_id <> 'raelynn';

-- event_reminders
alter table public.event_reminders add column if not exists community_id text not null default 'raelynn';
update public.event_reminders r
  set community_id = e.community_id
  from public.artist_events e
  where r.event_id = e.id and r.community_id = 'raelynn' and e.community_id <> 'raelynn';

-- fan_artist_following is supplanted by fan_community_memberships in 4b/4c.
-- We leave it in place for backward compat; the data layer will migrate.

-- policy_pages stays GLOBAL per the architecture decision. No community_id.


-- ─── 6. Street Team auto-enrollment trigger ───────────────────────────────
-- When a fan's street-team membership becomes active, mirror memberships
-- into every active artist community. Deliberately excludes `brand` types
-- (Nellie's) — food loyalty needs its own explicit opt-in.

create or replace function public.mirror_street_team_memberships()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if new.community_id = 'street-team' and new.status = 'active'
     and (tg_op = 'INSERT' or coalesce(old.status, 'pending') is distinct from 'active') then
    for r in
      select slug from communities
       where type = 'artist' and active = true
    loop
      insert into fan_community_memberships (fan_id, community_id, joined_at, status)
      values (new.fan_id, r.slug, now(), 'active')
      on conflict (fan_id, community_id) do nothing;
    end loop;
  end if;
  return new;
end $$;

drop trigger if exists fan_community_memberships_mirror_street_team
  on public.fan_community_memberships;
create trigger fan_community_memberships_mirror_street_team
  after insert or update of status on public.fan_community_memberships
  for each row execute function public.mirror_street_team_memberships();


-- ─── 7. RLS on new tables ─────────────────────────────────────────────────
-- NOTE: we intentionally do NOT tighten RLS on existing scoped tables in
-- this migration. Current policies (auth.uid() = fan_id etc.) remain in
-- force. Phase 4b/4c will evolve them to also check is_member_of() once
-- the data layer is updated and we can do coordinated testing.

alter table public.communities enable row level security;
alter table public.fan_community_memberships enable row level security;
alter table public.admin_users enable row level security;

-- communities: public read — landing pages + directory are anonymous-accessible.
drop policy if exists communities_public_read on public.communities;
create policy communities_public_read on public.communities
  for select using (true);

-- fan_community_memberships: fans read their own rows; community admins
-- can read their community's member roster.
drop policy if exists memberships_own_read on public.fan_community_memberships;
create policy memberships_own_read on public.fan_community_memberships
  for select using (
    auth.uid() = fan_id
    or is_admin_of(community_id)
  );

-- Fans can update their own membership (e.g. leave community, change status).
drop policy if exists memberships_own_update on public.fan_community_memberships;
create policy memberships_own_update on public.fan_community_memberships
  for update using (auth.uid() = fan_id) with check (auth.uid() = fan_id);

-- admin_users: a user can see their own admin grants; admins of a community
-- can see the full admin roster for their community.
drop policy if exists admin_users_self_read on public.admin_users;
create policy admin_users_self_read on public.admin_users
  for select using (
    auth.uid() = user_id
    or is_admin_of(community_id)
  );


-- ─── 8. Smoke-test queries ────────────────────────────────────────────────
-- Run these after the migration to verify state:
--
-- -- Communities seeded?
-- select slug, display_name, type, active, sort_order from communities order by sort_order;
-- -- Expected: 6 rows, raelynn active, everything else inactive.
--
-- -- Memberships backfilled?
-- select community_id, count(*) as members, sum(total_points) as total_pts
--   from fan_community_memberships group by 1;
-- -- Expected: one row for 'raelynn' matching count(*) on fans.
--
-- -- Every scoped table has a community_id?
-- select 'community_posts' as tbl, community_id, count(*) from community_posts group by 2
-- union all select 'artist_events',       community_id, count(*) from artist_events group by 2
-- union all select 'campaigns',           community_id, count(*) from campaigns group by 2
-- union all select 'fan_actions',         community_id, count(*) from fan_actions group by 2
-- union all select 'points_ledger',       community_id, count(*) from points_ledger group by 2
-- union all select 'fan_badges',          community_id, count(*) from fan_badges group by 2
-- union all select 'notifications',       community_id, count(*) from notifications group by 2
-- union all select 'offers',              community_id, count(*) from offers group by 2
-- union all select 'event_rsvps',         community_id, count(*) from event_rsvps group by 2
-- order by tbl;
--
-- -- Helper functions return expected shape (run as an authenticated admin):
-- -- select is_admin_of('raelynn'), is_member_of('raelynn');
--
-- -- Seed the first admin row (replace <UUID> with the Supabase user id
-- -- corresponding to Kevin's email — find via: select id from auth.users
-- -- where email = 'kevinjonassr@gmail.com';):
-- -- insert into admin_users (user_id, community_id, role)
-- -- values ('<UUID>', '*', 'owner');
