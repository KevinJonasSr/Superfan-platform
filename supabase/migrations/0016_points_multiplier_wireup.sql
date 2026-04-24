-- ────────────────────────────────────────────────────────────────────────────
-- Fan Engage — Phase 5e #16: wire points_multiplier() into community triggers
--
-- Phase 5d (migration 0015) added public.points_multiplier(fan_id, community_id)
-- but no trigger consumed it. This migration updates the four community-scoped
-- point-award functions so premium fans earn 1.5× on every engagement:
--
--   award_community_post_points      +5  → +8  (round(5 * 1.5))
--   award_community_comment_points   +2  → +3  (round(2 * 1.5))
--   award_poll_vote_points           +1  → +2  (round(1 * 1.5))
--   award_challenge_entry_points     +3  → +5  (round(3 * 1.5))
--
-- community_id = artist_slug. community_posts has it directly; the other three
-- tables reference a post_id and join to community_posts to find the slug.
--
-- Note on source_ref guard: points are idempotent per source_ref, so a fan who
-- was free when they commented and later upgrades to premium does NOT get a
-- retroactive multiplier — they get the multiplier on their NEXT action. That
-- matches the Stripe behavior ("premium earns 1.5× going forward").
--
-- Deferred to task #24 (not in this migration):
--   - award_event_rsvp_points     (event_rsvps → artist_events.artist_slug)
--   - award_fan_action_points     (fan_action_completions → fan_actions.artist_slug,
--                                  nullable for global actions — needs product call)
--
-- Triggers don't need to be dropped/recreated; CREATE OR REPLACE on the
-- function updates it in place and existing triggers continue to fire it.
--
-- Safe to re-run.
-- ────────────────────────────────────────────────────────────────────────────

-- ─── award_community_post_points ────────────────────────────────────────────
create or replace function public.award_community_post_points()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base_award   int     := 5;
  v_multiplier numeric := public.points_multiplier(new.author_id, new.artist_slug);
  award        int     := round(base_award * v_multiplier)::int;
  ref_id       text    := 'community_post:' || new.id::text;
begin
  if not exists (select 1 from points_ledger where source_ref = ref_id) then
    insert into points_ledger (fan_id, delta, source, source_ref, note)
    values (
      new.author_id, award, 'challenge', ref_id,
      case when v_multiplier > 1 then 'Community post (premium 1.5×)' else 'Community post' end
    );

    update fans
       set total_points = coalesce(total_points, 0) + award
     where id = new.author_id;
  end if;
  return new;
end $$;

-- ─── award_community_comment_points ─────────────────────────────────────────
create or replace function public.award_community_comment_points()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base_award   int     := 2;
  v_slug       text;
  v_multiplier numeric;
  award        int;
  ref_id       text    := 'community_comment:' || new.id::text;
begin
  select artist_slug into v_slug from public.community_posts where id = new.post_id;
  v_multiplier := public.points_multiplier(new.author_id, v_slug);
  award        := round(base_award * v_multiplier)::int;

  if not exists (select 1 from points_ledger where source_ref = ref_id) then
    insert into points_ledger (fan_id, delta, source, source_ref, note)
    values (
      new.author_id, award, 'challenge', ref_id,
      case when v_multiplier > 1 then 'Community comment (premium 1.5×)' else 'Community comment' end
    );

    update fans
       set total_points = coalesce(total_points, 0) + award
     where id = new.author_id;
  end if;
  return new;
end $$;

-- ─── award_poll_vote_points ─────────────────────────────────────────────────
create or replace function public.award_poll_vote_points()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base_award   int     := 1;
  v_slug       text;
  v_multiplier numeric;
  award        int;
  ref_id       text    := 'poll_vote:' || new.post_id::text || ':' || new.fan_id::text;
begin
  select artist_slug into v_slug from public.community_posts where id = new.post_id;
  v_multiplier := public.points_multiplier(new.fan_id, v_slug);
  award        := round(base_award * v_multiplier)::int;

  if not exists (select 1 from points_ledger where source_ref = ref_id) then
    insert into points_ledger (fan_id, delta, source, source_ref, note)
    values (
      new.fan_id, award, 'challenge', ref_id,
      case when v_multiplier > 1 then 'Poll vote (premium 1.5×)' else 'Poll vote' end
    );

    update fans
       set total_points = coalesce(total_points, 0) + award
     where id = new.fan_id;
  end if;
  return new;
end $$;

-- ─── award_challenge_entry_points ───────────────────────────────────────────
create or replace function public.award_challenge_entry_points()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base_award   int     := 3;
  v_slug       text;
  v_multiplier numeric;
  award        int;
  ref_id       text    := 'challenge_entry:' || new.id::text;
begin
  select artist_slug into v_slug from public.community_posts where id = new.post_id;
  v_multiplier := public.points_multiplier(new.fan_id, v_slug);
  award        := round(base_award * v_multiplier)::int;

  if not exists (select 1 from points_ledger where source_ref = ref_id) then
    insert into points_ledger (fan_id, delta, source, source_ref, note)
    values (
      new.fan_id, award, 'challenge', ref_id,
      case when v_multiplier > 1 then 'Challenge submission (premium 1.5×)' else 'Challenge submission' end
    );

    update fans
       set total_points = coalesce(total_points, 0) + award
     where id = new.fan_id;
  end if;
  return new;
end $$;

-- ─── Smoke tests (commented; uncomment to verify) ──────────────────────────
-- Free fan should see 1.0 multiplier, premium fan should see 1.5.
-- select public.points_multiplier(
--   (select fan_id from fan_community_memberships
--      where subscription_tier = 'free' limit 1),
--   'raelynn'
-- );  -- expect 1.0
-- select public.points_multiplier(
--   (select fan_id from fan_community_memberships
--      where subscription_tier = 'premium' limit 1),
--   'raelynn'
-- );  -- expect 1.5
--
-- Inspect the most recent ledger entries to confirm premium fans show
-- "(premium 1.5×)" in the note and the correct delta.
-- select delta, note, created_at from points_ledger
--  order by created_at desc limit 20;
