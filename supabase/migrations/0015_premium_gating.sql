-- ────────────────────────────────────────────────────────────────────────────
-- Fan Engage — Phase 5d: premium gating schema
--
-- Adds the two column-level access tags (community_posts.visibility,
-- artist_events.tier) and two helper functions (is_premium,
-- points_multiplier) that every entitlement check in the app runs through.
--
-- Keeping both columns as plain text with CHECK constraints rather than
-- enums so we can add more tiers (e.g. 'founder-only') without a migration.
--
-- Safe to re-run (all statements idempotent).
-- ────────────────────────────────────────────────────────────────────────────


-- ─── community_posts.visibility ───────────────────────────────────────────
alter table public.community_posts
  add column if not exists visibility text not null default 'public';

do $$
begin
  if not exists (
    select 1 from information_schema.check_constraints
    where constraint_name = 'community_posts_visibility_check'
  ) then
    alter table public.community_posts
      add constraint community_posts_visibility_check
      check (visibility in ('public', 'premium'));
  end if;
end $$;

create index if not exists community_posts_visibility_idx
  on public.community_posts (artist_slug, visibility, pinned desc, created_at desc);


-- ─── artist_events.tier ───────────────────────────────────────────────────
alter table public.artist_events
  add column if not exists tier text not null default 'public';

do $$
begin
  if not exists (
    select 1 from information_schema.check_constraints
    where constraint_name = 'artist_events_tier_check'
  ) then
    alter table public.artist_events
      add constraint artist_events_tier_check
      check (tier in ('public', 'premium'));
  end if;
end $$;


-- ─── is_premium(fan_id, community_id) ─────────────────────────────────────
-- Returns true iff the fan currently has Premium access in that community.
-- 'premium' and 'comped' are both full-access; 'past_due' is the grace
-- window where Stripe is still retrying the failed charge — the fan keeps
-- access until Stripe gives up and fires subscription.deleted. Any other
-- tier ('free', 'cancelled') → false.
create or replace function public.is_premium(
  p_fan_id      uuid,
  p_community_id text
)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from fan_community_memberships
    where fan_id = p_fan_id
      and community_id = p_community_id
      and subscription_tier in ('premium', 'comped', 'past_due')
  );
$$;


-- ─── points_multiplier(fan_id, community_id) ──────────────────────────────
-- Returns the multiplier to apply to any point-award action. Premium fans
-- earn 1.5× everything. Triggers in Phase 5e will start consuming this.
create or replace function public.points_multiplier(
  p_fan_id      uuid,
  p_community_id text
)
returns numeric language sql stable security definer set search_path = public as $$
  select case
    when public.is_premium(p_fan_id, p_community_id) then 1.5
    else 1.0
  end;
$$;


-- ─── Smoke tests (commented; uncomment to verify) ─────────────────────────
-- select public.is_premium((select id from fans limit 1), 'raelynn');
-- select public.points_multiplier((select id from fans limit 1), 'raelynn');
-- select visibility, count(*) from public.community_posts group by 1;
-- select tier, count(*) from public.artist_events group by 1;
