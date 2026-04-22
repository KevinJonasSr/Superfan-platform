-- ────────────────────────────────────────────────────────────────────────────
-- Fan Engage — initial schema
-- Safe to re-run (idempotent via IF NOT EXISTS / ON CONFLICT).
-- Apply via: Supabase dashboard → SQL Editor → paste → Run.
-- ────────────────────────────────────────────────────────────────────────────

-- ─── Extensions ─────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ─── Enums ──────────────────────────────────────────────────────────────────
do $$ begin
  create type tier_slug as enum ('bronze', 'silver', 'gold', 'platinum');
exception when duplicate_object then null; end $$;

do $$ begin
  create type point_source as enum (
    'signup_bonus', 'referral', 'challenge', 'purchase', 'manual_adjustment',
    'event_rsvp', 'event_attended', 'social_share', 'daily_checkin'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type offer_category as enum ('merch', 'experience', 'collectible', 'digital', 'ticket');
exception when duplicate_object then null; end $$;

do $$ begin
  create type purchase_status as enum ('pending', 'fulfilled', 'cancelled', 'refunded');
exception when duplicate_object then null; end $$;

-- ─── Tiers (seeded reference data) ──────────────────────────────────────────
create table if not exists public.tiers (
  slug          tier_slug primary key,
  display_name  text        not null,
  min_points    integer     not null,
  perks         jsonb       not null default '[]'::jsonb,
  sort_order    smallint    not null,
  created_at    timestamptz not null default now()
);

insert into public.tiers (slug, display_name, min_points, sort_order, perks) values
  ('bronze',   'Bronze',    0,     1, '["Welcome badge", "Access to fan home"]'::jsonb),
  ('silver',   'Silver',    2500,  2, '["Priority merch drops", "Monthly livestream"]'::jsonb),
  ('gold',     'Gold',      10000, 3, '["VIP soundcheck access", "Signed merch eligibility"]'::jsonb),
  ('platinum', 'Platinum',  25000, 4, '["Backstage experiences", "Meet & greet slots"]'::jsonb)
on conflict (slug) do nothing;

-- ─── Fans (profile row per auth user) ───────────────────────────────────────
create table if not exists public.fans (
  id             uuid primary key references auth.users(id) on delete cascade,
  email          citext unique,
  first_name     text,
  last_name      text,
  city           text,
  phone          text,
  handle         text,
  favorite_song  text,
  interest       text,
  referral_code  text unique default encode(gen_random_bytes(6), 'hex'),
  referred_by    uuid references public.fans(id) on delete set null,
  total_points   integer not null default 0,
  current_tier   tier_slug not null default 'bronze',
  sms_opted_in   boolean not null default false,
  email_opted_in boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists fans_referred_by_idx on public.fans (referred_by);
create index if not exists fans_current_tier_idx on public.fans (current_tier);

-- ─── Points ledger (immutable audit trail) ──────────────────────────────────
create table if not exists public.points_ledger (
  id          uuid primary key default gen_random_uuid(),
  fan_id      uuid not null references public.fans(id) on delete cascade,
  delta       integer not null,
  source      point_source not null,
  source_ref  text,
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists points_ledger_fan_idx on public.points_ledger (fan_id, created_at desc);

-- ─── Badges + fan_badges ────────────────────────────────────────────────────
create table if not exists public.badges (
  slug         text primary key,
  name         text not null,
  description  text,
  icon         text,
  point_value  integer not null default 0,
  created_at   timestamptz not null default now()
);

create table if not exists public.fan_badges (
  fan_id      uuid not null references public.fans(id) on delete cascade,
  badge_slug  text not null references public.badges(slug) on delete cascade,
  earned_at   timestamptz not null default now(),
  primary key (fan_id, badge_slug)
);

-- ─── Referrals ──────────────────────────────────────────────────────────────
create table if not exists public.referrals (
  id            uuid primary key default gen_random_uuid(),
  referrer_id   uuid not null references public.fans(id) on delete cascade,
  referred_id   uuid references public.fans(id) on delete set null,
  referred_email citext,
  status        text not null default 'pending', -- pending | verified | expired
  points_awarded integer not null default 0,
  created_at    timestamptz not null default now(),
  verified_at   timestamptz
);

create index if not exists referrals_referrer_idx on public.referrals (referrer_id, created_at desc);
create unique index if not exists referrals_referred_unique on public.referrals (referred_id) where referred_id is not null;

-- ─── Offers (marketplace items) ─────────────────────────────────────────────
create table if not exists public.offers (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  title         text not null,
  description   text,
  category      offer_category not null,
  price_points  integer,
  price_cents   integer,
  min_tier      tier_slug not null default 'bronze',
  inventory     integer,
  image_url     text,
  active        boolean not null default true,
  starts_at     timestamptz,
  ends_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists offers_active_idx on public.offers (active, starts_at, ends_at);

-- ─── Purchases ──────────────────────────────────────────────────────────────
create table if not exists public.purchases (
  id           uuid primary key default gen_random_uuid(),
  fan_id       uuid not null references public.fans(id) on delete cascade,
  offer_id     uuid not null references public.offers(id) on delete restrict,
  points_spent integer not null default 0,
  cents_spent  integer not null default 0,
  status       purchase_status not null default 'pending',
  fulfilled_at timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists purchases_fan_idx on public.purchases (fan_id, created_at desc);

-- ─── Updated-at trigger ─────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists fans_set_updated_at on public.fans;
create trigger fans_set_updated_at
  before update on public.fans
  for each row execute function public.set_updated_at();

-- ─── Auto-create fan row when a new auth user signs up ──────────────────────
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.fans (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ─── Row Level Security ─────────────────────────────────────────────────────
alter table public.fans           enable row level security;
alter table public.points_ledger  enable row level security;
alter table public.fan_badges     enable row level security;
alter table public.referrals      enable row level security;
alter table public.purchases      enable row level security;
-- Public read tables (tiers, badges, offers) still get RLS on, with permissive policies
alter table public.tiers          enable row level security;
alter table public.badges         enable row level security;
alter table public.offers         enable row level security;

-- Helper: drop-then-create so the migration stays idempotent
-- Fans: a user sees + updates only their own row
drop policy if exists fans_self_select on public.fans;
create policy fans_self_select on public.fans
  for select using (auth.uid() = id);

drop policy if exists fans_self_update on public.fans;
create policy fans_self_update on public.fans
  for update using (auth.uid() = id);

drop policy if exists fans_self_insert on public.fans;
create policy fans_self_insert on public.fans
  for insert with check (auth.uid() = id);

-- Points ledger: a user sees their own history. Writes flow through service role only.
drop policy if exists points_self_select on public.points_ledger;
create policy points_self_select on public.points_ledger
  for select using (auth.uid() = fan_id);

-- Fan badges: a user sees their own
drop policy if exists fan_badges_self_select on public.fan_badges;
create policy fan_badges_self_select on public.fan_badges
  for select using (auth.uid() = fan_id);

-- Referrals: a user sees referrals they made
drop policy if exists referrals_self_select on public.referrals;
create policy referrals_self_select on public.referrals
  for select using (auth.uid() = referrer_id);

drop policy if exists referrals_self_insert on public.referrals;
create policy referrals_self_insert on public.referrals
  for insert with check (auth.uid() = referrer_id);

-- Purchases: a user sees their own
drop policy if exists purchases_self_select on public.purchases;
create policy purchases_self_select on public.purchases
  for select using (auth.uid() = fan_id);

drop policy if exists purchases_self_insert on public.purchases;
create policy purchases_self_insert on public.purchases
  for insert with check (auth.uid() = fan_id);

-- Public reference data: any authenticated user can read
drop policy if exists tiers_public_read on public.tiers;
create policy tiers_public_read on public.tiers
  for select using (true);

drop policy if exists badges_public_read on public.badges;
create policy badges_public_read on public.badges
  for select using (true);

drop policy if exists offers_public_read on public.offers;
create policy offers_public_read on public.offers
  for select using (active = true);

-- ─── Smoke-test query (run this after the migration to verify) ──────────────
-- select table_name from information_schema.tables where table_schema='public' order by table_name;
