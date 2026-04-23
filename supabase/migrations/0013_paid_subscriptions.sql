-- ────────────────────────────────────────────────────────────────────────────
-- Fan Engage — Phase 5a: paid subscriptions foundation
--
-- Adds the schema for per-community $10/mo (or $99/yr) Premium subscriptions
-- via Stripe. Additive only — every column is new or has a default, so
-- existing app code keeps working. Checkout flow + webhook handler land
-- in Phase 5b/5c; this migration just sets up the tables and columns those
-- will write to.
--
-- Safe to re-run (idempotent).
-- ────────────────────────────────────────────────────────────────────────────


-- ─── 1. fans — Stripe customer id ─────────────────────────────────────────
-- One Stripe Customer per fan, shared across every community they
-- subscribe to. A fan subscribed to RaeLynn + Danger Twins has two
-- Stripe Subscriptions but one Customer record.

alter table public.fans
  add column if not exists stripe_customer_id text;

create unique index if not exists fans_stripe_customer_idx
  on public.fans (stripe_customer_id)
  where stripe_customer_id is not null;


-- ─── 2. fan_community_memberships — subscription state ────────────────────
-- subscription_tier:
--   'free'       — default; no paid subscription
--   'premium'    — active paid Stripe subscription
--   'past_due'   — card declined, in Stripe's retry grace window (~14 days);
--                  keeps access while we prompt for card update
--   'cancelled'  — user cancelled; keeps access until current_period_end,
--                  then transitions to 'free'
--   'comped'     — manually granted (Street Team, customer service overrides)

alter table public.fan_community_memberships
  add column if not exists subscription_tier text not null default 'free'
    check (subscription_tier in ('free','premium','past_due','cancelled','comped')),
  add column if not exists stripe_subscription_id text,
  add column if not exists current_period_end timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists is_founder boolean not null default false,
  add column if not exists founder_number integer,
  add column if not exists monthly_credit_cents integer not null default 0,
  add column if not exists monthly_credit_refreshed_at timestamptz,
  add column if not exists billing_period text
    check (billing_period is null or billing_period in ('monthly','annual'));

create unique index if not exists fcm_stripe_subscription_idx
  on public.fan_community_memberships (stripe_subscription_id)
  where stripe_subscription_id is not null;

-- Unique founder_number per community (no duplicate "Founding Fan #7" slots)
create unique index if not exists fcm_founder_number_idx
  on public.fan_community_memberships (community_id, founder_number)
  where founder_number is not null;


-- ─── 3. communities — Stripe product + 4 prices + founder cap ─────────────
-- Four prices per community:
--   standard_monthly  — $10/mo
--   standard_annual   — $99/yr (save ~17%)
--   founder_monthly   — $10/mo LOCKED FOREVER (first `founder_cap` subs)
--   founder_annual    — $99/yr LOCKED FOREVER
--
-- Kept as separate price_ids so we can raise standard pricing in the future
-- without migrating existing founders to a new price.

alter table public.communities
  add column if not exists stripe_product_id text,
  add column if not exists stripe_price_id_monthly text,
  add column if not exists stripe_price_id_annual text,
  add column if not exists stripe_price_id_founder_monthly text,
  add column if not exists stripe_price_id_founder_annual text,
  add column if not exists monthly_price_cents integer not null default 1000,
  add column if not exists annual_price_cents integer not null default 9900,
  add column if not exists founder_cap integer not null default 100;


-- ─── 4. badges — tier column ──────────────────────────────────────────────
-- Foundation badges stay free-tier (keeps conversion funnel alive — a free
-- fan who earned "Recruiter" sees the ladder continues and only unlocks
-- via Premium). Prestige badges gate behind Premium.

alter table public.badges
  add column if not exists tier text not null default 'free'
    check (tier in ('free','premium'));

update public.badges set tier = 'premium' where slug in (
  'referral-5',           -- Connector
  'referral-10',          -- Ambassador
  'poll-voter-5',         -- Poll voter
  'challenge-crasher-10', -- Challenge crasher
  'chatterbox-25',        -- Chatterbox
  'tier-silver',
  'tier-gold',
  'tier-platinum'
);

-- Seed the Founding Fan badge. One-time award when a fan enters the
-- founder cohort. Premium-tier so it only awards to paying (or comped)
-- subscribers.
insert into public.badges (slug, name, description, icon, point_value, category, threshold, sort_order, tier)
values (
  'founding-fan',
  'Founding Fan',
  'Among the first 100 subscribers to this community. Locked-in pricing for life.',
  '🌟',
  500,
  'tier',
  null,
  14,
  'premium'
)
on conflict (slug) do update set
  description = excluded.description,
  tier        = excluded.tier,
  sort_order  = excluded.sort_order;


-- ─── 5. stripe_events — idempotent webhook log ────────────────────────────
-- Stripe may deliver the same event_id more than once. We record every id
-- we've seen so replays become no-ops. The payload is stored so we can
-- debug after the fact without pulling from Stripe.

create table if not exists public.stripe_events (
  id             text primary key,
  type           text not null,
  community_id   text,
  fan_id         uuid references public.fans(id) on delete set null,
  received_at    timestamptz not null default now(),
  processed_at   timestamptz,
  error          text,
  payload        jsonb not null
);

create index if not exists stripe_events_received_idx
  on public.stripe_events (received_at desc);
create index if not exists stripe_events_type_idx
  on public.stripe_events (type, received_at desc);


-- ─── 6. credit_grants — audit trail for monthly $5 credit ─────────────────
-- Every time the cron refreshes a Premium member's $5/mo credit we record
-- it here. Gives us a trail to detect abuse (churn + resubscribe cycles)
-- and to reconstruct a member's credit history.

create table if not exists public.credit_grants (
  id                uuid primary key default gen_random_uuid(),
  fan_id            uuid not null references public.fans(id) on delete cascade,
  community_id      text not null references public.communities(slug) on delete cascade,
  amount_cents      integer not null,
  reason            text not null,                 -- 'monthly_refresh' | 'manual' | 'promo'
  granted_at        timestamptz not null default now(),
  granted_by        uuid references public.fans(id) on delete set null,
  stripe_event_id   text references public.stripe_events(id)
);

create index if not exists credit_grants_fan_idx
  on public.credit_grants (fan_id, granted_at desc);
create index if not exists credit_grants_community_idx
  on public.credit_grants (community_id, granted_at desc);


-- ─── 7. RLS ───────────────────────────────────────────────────────────────

alter table public.stripe_events enable row level security;
-- stripe_events is service-role only — no fan or admin should read it
-- directly from the browser. No policies = no access.

alter table public.credit_grants enable row level security;
drop policy if exists credit_grants_own_read on public.credit_grants;
create policy credit_grants_own_read on public.credit_grants
  for select using (
    auth.uid() = fan_id
    or is_admin_of(community_id)
  );


-- ─── 8. Smoke-test queries ────────────────────────────────────────────────
-- Run after the migration to verify:
--
-- -- Columns landed?
-- select column_name, data_type, column_default
--   from information_schema.columns
--  where table_schema = 'public'
--    and table_name = 'fan_community_memberships'
--    and column_name in ('subscription_tier','stripe_subscription_id','is_founder','monthly_credit_cents');
--
-- -- Badges tiered correctly? Expect 8 premium badges (after migration runs).
-- select tier, count(*) from badges group by tier;
--
-- -- Communities ready to be seeded with Stripe ids?
-- select slug, monthly_price_cents, annual_price_cents, founder_cap,
--        stripe_product_id is not null as has_product
--   from communities where type = 'artist' order by sort_order;
