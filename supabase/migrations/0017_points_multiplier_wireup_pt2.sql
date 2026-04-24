-- ────────────────────────────────────────────────────────────────────────────
-- Fan Engage — Phase 5e #24: wire points_multiplier() into RSVP + fan-action
--
-- Completes the trigger wire-up started in migration 0016. Extends the 1.5×
-- Premium multiplier to the remaining two point-award triggers:
--
--   award_event_rsvp_points    +10 → +15  (round(10 * 1.5))
--   award_fan_action_points    dynamic (fan_actions.point_value)
--
-- Design decisions
-- ────────────────
--
-- event_rsvps: straightforward. event_rsvps has event_id; artist_events has
-- artist_slug. One lookup to get the community, then the standard multiplier.
--
-- fan_action_completions: fan_actions.artist_slug is NULLABLE (global
-- actions don't belong to any single community). The product call we're
-- making here:
--
--     * Scoped actions (artist_slug IS NOT NULL) apply the multiplier based
--       on the fan's membership in THAT community — same rule as posts.
--     * Global actions (artist_slug IS NULL) award the flat base points,
--       no multiplier. Premium is a per-community benefit; rewarding it on
--       cross-community actions would blur the model (and over-reward
--       anyone with premium in one community doing unrelated global CTAs).
--
-- If product later wants a "has premium anywhere" multiplier for global
-- actions, that's a follow-up with its own semantic — easier to add later
-- than roll back.
--
-- Triggers don't need to be dropped/recreated; CREATE OR REPLACE on the
-- function updates it in place and existing triggers continue to fire it.
--
-- Safe to re-run.
-- ────────────────────────────────────────────────────────────────────────────

-- ─── award_event_rsvp_points ────────────────────────────────────────────────
create or replace function public.award_event_rsvp_points()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base_award   int     := 10;
  v_slug       text;
  v_multiplier numeric;
  award        int;
  ref_id       text    := 'event_rsvp:' || new.event_id::text || ':' || new.fan_id::text;
begin
  select artist_slug into v_slug from public.artist_events where id = new.event_id;
  v_multiplier := public.points_multiplier(new.fan_id, v_slug);
  award        := round(base_award * v_multiplier)::int;

  if not exists (select 1 from points_ledger where source_ref = ref_id) then
    insert into points_ledger (fan_id, delta, source, source_ref, note)
    values (
      new.fan_id, award, 'event_rsvp', ref_id,
      case when v_multiplier > 1 then 'RSVPed to event (premium 1.5×)' else 'RSVPed to event' end
    );

    update fans
       set total_points = coalesce(total_points, 0) + award
     where id = new.fan_id;
  end if;
  return new;
end $$;

-- ─── award_fan_action_points ────────────────────────────────────────────────
-- Before-insert trigger: computes the award, optionally ×1.5 for premium
-- members of the action's home community, and stamps new.points_awarded so
-- the completion row records what was actually earned.
create or replace function public.award_fan_action_points()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_base        int;
  v_slug        text;
  v_multiplier  numeric;
  v_award       int;
  v_ref         text;
  v_is_premium  boolean;
begin
  -- Pull the action's base points and home community in one go.
  select point_value, artist_slug into v_base, v_slug
    from fan_actions where id = new.action_id;
  if v_base is null or v_base <= 0 then return new; end if;

  -- Scoped action → per-community multiplier. Global action (slug NULL)
  -- → flat base, no multiplier (see migration header for rationale).
  if v_slug is null then
    v_multiplier := 1.0;
    v_is_premium := false;
  else
    v_multiplier := public.points_multiplier(new.fan_id, v_slug);
    v_is_premium := v_multiplier > 1;
  end if;

  v_award := round(v_base * v_multiplier)::int;
  v_ref   := 'fan_action:' || new.action_id::text || ':' || new.fan_id::text;

  if not exists (select 1 from points_ledger where source_ref = v_ref) then
    insert into points_ledger (fan_id, delta, source, source_ref, note)
    values (
      new.fan_id, v_award, 'social_share', v_ref,
      case when v_is_premium then 'CTA completed (premium 1.5×)' else 'CTA completed' end
    );

    update fans
       set total_points = coalesce(total_points, 0) + v_award
     where id = new.fan_id;

    new.points_awarded := v_award;
  end if;
  return new;
end $$;

-- ─── Smoke tests (commented; uncomment to verify) ──────────────────────────
-- 1. Function definitions are the new versions (no stale bodies lingering):
-- select proname, pg_get_function_arguments(oid)
--   from pg_proc
--  where proname in (
--    'is_premium','points_multiplier',
--    'award_community_post_points','award_community_comment_points',
--    'award_poll_vote_points','award_challenge_entry_points',
--    'award_event_rsvp_points','award_fan_action_points'
--  );
--
-- 2. Premium breakdown across memberships:
-- select subscription_tier, count(*)
--   from fan_community_memberships
--  group by 1 order by 1;
--
-- 3. Sanity-check the multiplier for each (fan, community) pair:
-- select community_id, subscription_tier, count(*),
--        public.points_multiplier(fan_id, community_id) as sample_mult
--   from fan_community_memberships
--  group by community_id, subscription_tier, sample_mult
--  order by community_id, subscription_tier;
--
-- 4. Inspect recent ledger activity for the '(premium 1.5×)' marker:
-- select delta, source, note, created_at
--   from points_ledger
--  order by created_at desc limit 20;
