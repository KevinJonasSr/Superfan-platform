-- ============================================================================
-- 0023_fix_award_badge_delegate.sql
-- ============================================================================
-- Fixes a launch-blocking signup failure introduced by 0011_multi_tenant.
--
-- Symptom (before fix)
--   POST /signup returned HTTP 500 with body
--     {"msg":"500: Database error saving new user"}
--   Auth logs surfaced the underlying Postgres error:
--     ERROR: there is no unique or exclusion constraint matching the
--            ON CONFLICT specification (SQLSTATE 42P10)
--
-- Root cause
--   The 0011_multi_tenant migration added `community_id` to the primary key
--   on `public.fan_badges`. The PK is now (fan_id, badge_slug, community_id).
--   But the legacy `public.award_badge(uuid, text)` function was never
--   updated — its body still does
--     insert into fan_badges (fan_id, badge_slug)
--     values (...)
--     on conflict (fan_id, badge_slug) do nothing
--   That two-column conflict target no longer matches any unique constraint,
--   so Postgres throws 42P10 at plan time. Every fan signup chain hits this:
--     auth.users INSERT
--       → on_auth_user_created  → handle_new_auth_user()
--           → INSERT INTO public.fans
--               → fans_award_signup_badges → award_signup_badges()
--                   → perform award_badge(new.id, 'welcome')      ← 42P10
--                   → perform award_badge(new.id, 'tier-bronze')  ← 42P10
--   The transaction aborts, the auth.users row is rolled back, and the
--   signup form gets the generic error.
--
-- Fix
--   Re-write `award_badge(uuid, text)` as a thin shim that delegates to
--   the modern `award_community_badge(uuid, text, text)` (added in
--   0018_award_community_badge.sql), which already uses the correct
--   3-column conflict target. We pass community_id = 'raelynn' as the
--   default — that matches the existing data convention (all 9 historical
--   fan_badges rows are scoped to 'raelynn' via the table's column default).
--
-- Verification (run after applying)
--   -- Probe should return null/void with no error:
--   select award_badge('<some-existing-fan-uuid>', 'welcome');
--
--   -- Listing should be unchanged for fans who already have the badge:
--   select badge_slug, community_id, earned_at
--   from public.fan_badges where fan_id = '<some-existing-fan-uuid>';
--
--   -- End-to-end: a brand-new email should now sign up cleanly via the
--   -- /signup form on fan-engage-pearl.vercel.app.
--
-- Architectural follow-up (not blocking)
--   Welcome and tier-bronze are platform-wide badges, not RaeLynn-scoped.
--   The current schema doesn't have a "platform" community, so we use
--   'raelynn' as a stand-in. A cleaner long-term model would either:
--     (a) introduce a 'platform' or '*' community for non-scoped badges
--     (b) split badges into platform_badges + community_badges tables
--   Tracked as a post-launch nice-to-have.
-- ============================================================================

create or replace function public.award_badge(p_fan_id uuid, p_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform award_community_badge(p_fan_id, p_slug, 'raelynn');
end $$;
