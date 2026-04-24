-- ────────────────────────────────────────────────────────────────────────────
-- Fan Engage — Rewards Redemption System
-- Safe to re-run (idempotent).
-- ────────────────────────────────────────────────────────────────────────────

-- ─── Add 'reward_redemption' to point_source enum ───────────────────────────
do $$ begin
  alter type point_source add value 'reward_redemption' if not exists;
exception when others then null; end $$;

-- ─── Rewards Catalog ──────────────────────────────────────────────────────
-- The rewards artists offer fans in their communities.
-- Admin-editable. Can be community-scoped OR global (community_id null = global).
create table if not exists public.rewards_catalog (
  id              uuid primary key default gen_random_uuid(),
  community_id    text references public.communities(slug) on delete cascade,
  title           text not null,
  description     text,
  image_url       text,
  point_cost      integer not null check (point_cost > 0),
  kind            text not null check (kind in ('merch_discount','voice_note','video_shoutout','early_access','custom','experience')),
  stock           integer,
  active          boolean not null default true,
  sort_order      smallint not null default 0,
  requires_tier   text check (requires_tier in ('premium','founder-only') or requires_tier is null),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists rewards_catalog_community_idx
  on public.rewards_catalog (community_id, active, sort_order);

-- ─── Reward Redemptions ───────────────────────────────────────────────────
-- The "order history" for points spend.
-- Status: pending → fulfilled / cancelled
create table if not exists public.reward_redemptions (
  id                uuid primary key default gen_random_uuid(),
  fan_id            uuid not null references public.fans(id) on delete cascade,
  reward_id         uuid not null references public.rewards_catalog(id) on delete restrict,
  community_id      text references public.communities(slug) on delete set null,
  point_cost        integer not null,
  status            text not null default 'pending' check (status in ('pending','fulfilled','cancelled')),
  delivery_details  text,
  fulfillment_note  text,
  created_at        timestamptz not null default now(),
  fulfilled_at      timestamptz,
  cancelled_at      timestamptz
);

create index if not exists reward_redemptions_fan_idx
  on public.reward_redemptions (fan_id, created_at desc);

create index if not exists reward_redemptions_status_idx
  on public.reward_redemptions (community_id, status, created_at desc);

-- ─── RLS ──────────────────────────────────────────────────────────────────
alter table public.rewards_catalog enable row level security;
alter table public.reward_redemptions enable row level security;

-- rewards_catalog: public read of active rows
drop policy if exists rewards_catalog_public_read on public.rewards_catalog;
create policy rewards_catalog_public_read on public.rewards_catalog
  for select using (active = true);

-- reward_redemptions: fans see their own; admins see all in their community
drop policy if exists redemptions_fan_read on public.reward_redemptions;
create policy redemptions_fan_read on public.reward_redemptions
  for select using (auth.uid() = fan_id);

drop policy if exists redemptions_admin_read on public.reward_redemptions;
create policy redemptions_admin_read on public.reward_redemptions
  for select using (
    auth.uid() in (
      select fan_id from fan_community_memberships
      where community_id = reward_redemptions.community_id
      and is_admin = true
    )
  );

-- ─── Helper: redeem_reward ────────────────────────────────────────────────
-- Atomically:
-- 1. Check fan has enough points
-- 2. Check reward is active and in-stock
-- 3. Check tier gating
-- 4. Insert redemption row
-- 5. Decrement fan points (global + per-community)
-- 6. Write points_ledger entry
-- 7. Decrement stock
-- 8. Notify fan
-- Returns redemption id or raises exception
create or replace function public.redeem_reward(
  p_fan_id uuid,
  p_reward_id uuid,
  p_delivery_details text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_fan fans%rowtype;
  v_reward rewards_catalog%rowtype;
  v_membership fan_community_memberships%rowtype;
  v_redemption_id uuid;
begin
  -- Lock the reward row to prevent overselling
  select * into v_reward from rewards_catalog where id = p_reward_id
  for update;

  if v_reward is null then
    raise exception 'Reward not found';
  end if;

  if not v_reward.active then
    raise exception 'Reward is no longer available';
  end if;

  if v_reward.stock is not null and v_reward.stock <= 0 then
    raise exception 'Reward is out of stock';
  end if;

  -- Get fan and check total points
  select * into v_fan from fans where id = p_fan_id;
  if v_fan is null then
    raise exception 'Fan not found';
  end if;

  if v_fan.total_points < v_reward.point_cost then
    raise exception 'Insufficient points';
  end if;

  -- Check tier gating if required
  if v_reward.requires_tier is not null then
    select * into v_membership from fan_community_memberships
    where fan_id = p_fan_id and community_id = v_reward.community_id;

    if v_membership is null then
      raise exception 'Not a member of this community';
    end if;

    if v_reward.requires_tier = 'premium' and v_membership.subscription_tier != 'premium' then
      raise exception 'Premium membership required';
    end if;

    if v_reward.requires_tier = 'founder-only' and v_membership.subscription_tier != 'founder' then
      raise exception 'Founder status required';
    end if;
  end if;

  -- Insert redemption row
  insert into reward_redemptions (fan_id, reward_id, community_id, point_cost, delivery_details, status)
  values (p_fan_id, p_reward_id, v_reward.community_id, v_reward.point_cost, p_delivery_details, 'pending')
  returning id into v_redemption_id;

  -- Decrement global points
  update fans set total_points = total_points - v_reward.point_cost
  where id = p_fan_id;

  -- Decrement community points if scoped
  if v_reward.community_id is not null then
    update fan_community_memberships
    set total_points = total_points - v_reward.point_cost
    where fan_id = p_fan_id and community_id = v_reward.community_id;
  end if;

  -- Write points ledger
  insert into points_ledger (fan_id, delta, source, source_ref, note)
  values (
    p_fan_id,
    -v_reward.point_cost,
    'reward_redemption',
    'redemption:' || v_redemption_id,
    'Redeemed: ' || v_reward.title
  );

  -- Decrement stock if non-null
  if v_reward.stock is not null then
    update rewards_catalog set stock = stock - 1 where id = p_reward_id;
  end if;

  -- Notify fan
  perform upsert_notification(
    p_fan_id,
    'reward_redeemed',
    'Reward redeemed!',
    'You''ve redeemed ' || v_reward.title || '. An artist will fulfill it soon.',
    '/artists/' || v_reward.community_id || '/rewards',
    null,
    'redemption:' || v_redemption_id
  );

  return v_redemption_id;
end $$;

-- ─── Seed placeholder rewards for 'raelynn' community ──────────────────────
insert into public.rewards_catalog (community_id, title, description, image_url, point_cost, kind, stock, active, sort_order, requires_tier, created_at, updated_at)
select
  'raelynn',
  title,
  description,
  image_url,
  point_cost,
  kind,
  null,
  true,
  sort_order,
  null,
  now(),
  now()
from (
  values
    ('Early Album Access', 'Get first access to new releases before they drop publicly', null, 1000, 'early_access', 0),
    ('Personal Voice Note', 'A personalized 30-second voice note just for you', null, 5000, 'voice_note', 1),
    ('Merch Discount Code', '25% off an exclusive merch drop', null, 2500, 'merch_discount', 2),
    ('Video Shoutout', 'A personal video shoutout to you and your friends', null, 25000, 'video_shoutout', 3)
) as rewards(title, description, image_url, point_cost, kind, sort_order)
where not exists (
  select 1 from public.rewards_catalog
  where community_id = 'raelynn' and kind = rewards.kind
);
