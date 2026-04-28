-- ============================================================================
-- 0026_draft_used.sql — Fan Engage AI: track AI-drafted comments
-- ============================================================================
-- Phase 3 of FAN_ENGAGE_AI_RECOMMENDATIONS.md (recommendation #3).
--
-- Tiny migration — adds a boolean flag to community_comments so we can
-- A/B test whether the AI-drafted-replies feature actually lifts comment
-- volume (the rec doc's success criterion: comment volume +30% on posts
-- where the drafter is shown).
--
-- The flag is set true at insert time when the comment originated from a
-- user clicking one of the AI-generated draft chips and (optionally
-- editing it) before sending. False when the user wrote organically.
--
-- Idempotent. Safe to re-run.
-- ============================================================================

-- ─── 1. draft_used column ────────────────────────────────────────────────
alter table public.community_comments
  add column if not exists draft_used boolean not null default false;

comment on column public.community_comments.draft_used is
  'True if this comment originated from an AI-generated draft chip in the comment composer (user may have edited it before sending). Used for measuring the engagement lift of AI-drafted replies.';

-- Partial index — most rows will be false, queries that ask "how many
-- drafted comments did we get last week" only need to scan the small
-- subset where draft_used = true.
create index if not exists community_comments_draft_used_idx
  on public.community_comments (created_at desc)
  where draft_used = true;

-- ─── 2. Verify (commented; uncomment to spot-check) ──────────────────────
-- select draft_used, count(*) from public.community_comments group by 1;
