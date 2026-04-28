-- ────────────────────────────────────────────────────────────────────────────
-- Fan Engage — Phase 12: Image-aware post captions (A/B flag)
-- Recommendation #12 from FAN_ENGAGE_AI_RECOMMENDATIONS.md.
--
-- Tracks whether a community_posts row was created using a Claude-suggested
-- caption (true) vs typed entirely by the fan (false). Mirrors the
-- draft_used flag from Phase 3 so we can A/B compare post engagement
-- between AI-assisted and unassisted posts.
--
-- Safe to re-run (idempotent). Apply via: Supabase SQL Editor → paste → Run.
-- ────────────────────────────────────────────────────────────────────────────

alter table public.community_posts
  add column if not exists caption_used boolean not null default false;

comment on column public.community_posts.caption_used is
  'Phase 12: true if the post body was prefilled from a Claude vision
   caption suggestion. Used post-launch to A/B-compare engagement
   between AI-assisted and unassisted image posts.';
