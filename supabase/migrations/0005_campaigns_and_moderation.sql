-- ────────────────────────────────────────────────────────────────────────────
-- Fan Engage — Phase 2c: admin dashboard (campaigns + CTAs + moderation)
-- Safe to re-run (idempotent).
-- Apply via: Supabase dashboard → SQL Editor → paste → Run.
-- ────────────────────────────────────────────────────────────────────────────

-- ─── Moderation: suspend flag on fans ─────────────────────────────────────
alter table public.fans
  add column if not exists suspended boolean not null default false;

-- ─── Fan action kinds (CTAs: pre-save, share, radio, etc.) ────────────────
do $$ begin
  create type fan_action_kind as enum (
    'pre_save', 'stream', 'share', 'radio_request',
    'playlist_add', 'social_follow', 'custom'
  );
exception when duplicate_object then null; end $$;

-- ─── Campaigns ─────────────────────────────────────────────────────────────
create table if not exists public.campaigns (
  id            uuid primary key default gen_random_uuid(),
  artist_slug   text not null,
  title         text not null,
  description   text,
  created_by    uuid references public.fans(id) on delete set null,
  published_at  timestamptz,
  ends_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists campaigns_artist_idx on public.campaigns (artist_slug, created_at desc);
create index if not exists campaigns_published_idx on public.campaigns (published_at desc);

-- ─── Fan actions (CTAs — shown to fans, completion awards points) ─────────
create table if not exists public.fan_actions (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid references public.campaigns(id) on delete cascade,
  artist_slug   text,                        -- nullable = global
  kind          fan_action_kind not null,
  title         text not null,
  description   text,
  url           text,                        -- where the fan goes to complete
  cta_label     text not null default 'Complete',
  point_value   integer not null default 25,
  active        boolean not null default true,
  sort_order    smallint not null default 0,
  ends_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists fan_actions_artist_idx on public.fan_actions (artist_slug, active);
create index if not exists fan_actions_campaign_idx on public.fan_actions (campaign_id);

-- ─── Fan action completions (one per fan per action) ──────────────────────
create table if not exists public.fan_action_completions (
  fan_id        uuid not null references public.fans(id) on delete cascade,
  action_id     uuid not null references public.fan_actions(id) on delete cascade,
  completed_at  timestamptz not null default now(),
  points_awarded integer not null default 0,
  primary key (fan_id, action_id)
);

-- ─── Campaign items (what was bundled into a campaign for reporting) ──────
create table if not exists public.campaign_items (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references public.campaigns(id) on delete cascade,
  item_kind     text not null,   -- 'announcement' | 'poll' | 'challenge' | 'offer' | 'action' | 'email' | 'sms' | 'badge'
  ref_id        text,            -- pk of the thing we created (uuid or slug)
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists campaign_items_campaign_idx on public.campaign_items (campaign_id, created_at);

-- ─── Award points on fan_action_completion insert ─────────────────────────
create or replace function public.award_fan_action_points()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_pts integer;
  v_ref text;
begin
  select point_value into v_pts from fan_actions where id = new.action_id;
  if v_pts is null or v_pts <= 0 then return new; end if;

  v_ref := 'fan_action:' || new.action_id::text || ':' || new.fan_id::text;
  if not exists (select 1 from points_ledger where source_ref = v_ref) then
    insert into points_ledger (fan_id, delta, source, source_ref, note)
    values (new.fan_id, v_pts, 'social_share', v_ref, 'CTA completed');

    update fans set total_points = coalesce(total_points, 0) + v_pts
      where id = new.fan_id;

    new.points_awarded := v_pts;
  end if;
  return new;
end $$;

drop trigger if exists fan_action_completions_award_points on public.fan_action_completions;
create trigger fan_action_completions_award_points
  before insert on public.fan_action_completions
  for each row execute function public.award_fan_action_points();

-- ─── Row Level Security ────────────────────────────────────────────────────
alter table public.campaigns                enable row level security;
alter table public.campaign_items           enable row level security;
alter table public.fan_actions              enable row level security;
alter table public.fan_action_completions   enable row level security;

-- Campaigns: authenticated read of published; writes via service role (admin)
drop policy if exists campaigns_public_read on public.campaigns;
create policy campaigns_public_read on public.campaigns
  for select using (auth.role() = 'authenticated' and published_at is not null);

drop policy if exists campaign_items_public_read on public.campaign_items;
create policy campaign_items_public_read on public.campaign_items
  for select using (auth.role() = 'authenticated');

-- Fan actions: authenticated read of active ones; writes via service role
drop policy if exists fan_actions_public_read on public.fan_actions;
create policy fan_actions_public_read on public.fan_actions
  for select using (auth.role() = 'authenticated' and active = true);

-- Fan action completions: a fan inserts + reads their own
drop policy if exists fan_action_completions_select_own on public.fan_action_completions;
create policy fan_action_completions_select_own on public.fan_action_completions
  for select using (auth.uid() = fan_id);

drop policy if exists fan_action_completions_insert_own on public.fan_action_completions;
create policy fan_action_completions_insert_own on public.fan_action_completions
  for insert with check (auth.uid() = fan_id);

-- ─── Smoke test ────────────────────────────────────────────────────────────
-- select table_name from information_schema.tables
-- where table_schema = 'public' and
--       table_name in ('campaigns','campaign_items','fan_actions','fan_action_completions');
