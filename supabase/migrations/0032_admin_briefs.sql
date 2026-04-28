-- ────────────────────────────────────────────────────────────────────────────
-- Fan Engage — Phase 15: Engagement anomaly detection (admin daily brief)
-- Recommendation #15 from FAN_ENGAGE_AI_RECOMMENDATIONS.md.
--
-- Daily cron writes one row per run with week-over-week metrics and a
-- Claude-generated narrative summary. Admins view recent briefs at
-- /admin/briefs; optional Slack webhook delivery on top.
--
-- Safe to re-run (idempotent). Apply via: Supabase SQL Editor → paste → Run.
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.admin_briefs (
  id              uuid primary key default gen_random_uuid(),
  -- The window the brief covers (inclusive of "this week" — last 7 days
  -- back from generated_at). Stored explicitly so we can re-run a
  -- brief for a backfilled date without ambiguity.
  window_end      timestamptz not null default now(),
  -- jsonb structure:
  --   {
  --     platform: { signups, posts, comments, reactions, active_fans, ... },
  --     communities: [
  --       { slug, display_name, posts, comments, ..., wow: {...}, top_post },
  --       ...
  --     ],
  --     anomalies: [{ kind, severity, detail, community_id? }, ...]
  --   }
  metrics         jsonb not null,
  -- Plain-text Claude-generated narrative. Bullet-list of 3–5 lines
  -- per community + a top-line summary. Easy to paste into Slack.
  summary         text not null,
  -- Versioning so prompt changes are auditable.
  prompt_version  text not null default 'v1',
  -- Channels we actually delivered to. ['slack'] / ['email'] / [].
  channels_sent   text[] not null default '{}',
  -- For debugging Anthropic responses.
  model           text not null default 'claude-haiku-4-5',
  generated_ms    int,
  created_at      timestamptz not null default now()
);

create index if not exists admin_briefs_created_idx
  on public.admin_briefs (created_at desc);

-- ─── RLS ──────────────────────────────────────────────────────────────────
-- Admin-only. Service role bypasses RLS as usual; the admin UI uses the
-- admin client. No public select.
alter table public.admin_briefs enable row level security;

comment on table public.admin_briefs is
  'Daily Phase 15 admin briefs. metrics is the raw WoW data the Claude
   summarizer was given; summary is the narrative we send to Slack /
   email / display in /admin/briefs. Re-running the cron creates a new
   row — we never overwrite — so the table doubles as a history log.';

comment on column public.admin_briefs.metrics is
  'jsonb { platform, communities[], anomalies[] }. Schema is informal
   on purpose so we can add new metric dimensions without migrations.';
