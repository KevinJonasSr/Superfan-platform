-- ────────────────────────────────────────────────────────────────────────────
-- Fan Engage — Phase 8: Smart event-match notifications
-- Recommendation #8 from FAN_ENGAGE_AI_RECOMMENDATIONS.md.
--
-- When a new event is created, score the artist's followers on geo
-- proximity, past RSVP rate, recent engagement, and tier; cap at the
-- top 25%; let an admin review the candidate list and click "send".
-- This migration adds the audit log + a column to track which events
-- have been processed.
--
-- Safe to re-run (idempotent). Apply via: Supabase SQL Editor → paste → Run.
-- ────────────────────────────────────────────────────────────────────────────

-- ─── 1. artist_events.match_processed_at ───────────────────────────────────
-- Set by the prepare cron (Phase 8.5) once a candidate set has been
-- computed and saved into event_match_log. NULL = needs scoring.
alter table public.artist_events
  add column if not exists match_processed_at timestamptz;

create index if not exists artist_events_match_pending_idx
  on public.artist_events (starts_at)
  where match_processed_at is null and active = true;

-- ─── 2. event_match_log ────────────────────────────────────────────────────
-- One row per event × candidate fan. score_components is a jsonb blob
-- (geo / past_rsvp / engagement / tier_weight) so we can audit why a
-- specific fan was or wasn't picked.
create table if not exists public.event_match_log (
  event_id        uuid not null references public.artist_events(id) on delete cascade,
  fan_id          uuid not null references public.fans(id) on delete cascade,
  computed_at     timestamptz not null default now(),
  total_score     real not null,
  score_components jsonb not null,
  -- Whether this fan made the top-25% cap.
  is_candidate    boolean not null,
  -- Channels we actually fired. Filled in when admin clicks "Send".
  -- NULL = not sent yet.
  sent_at         timestamptz,
  channels_sent   text[] not null default '{}',
  primary key (event_id, fan_id)
);

create index if not exists event_match_log_event_idx
  on public.event_match_log (event_id, total_score desc);

create index if not exists event_match_log_unsent_idx
  on public.event_match_log (event_id)
  where is_candidate = true and sent_at is null;

-- ─── 3. RLS ────────────────────────────────────────────────────────────────
-- Admin-only table. Fans never read this directly — they see the
-- resulting notifications in their inbox.
alter table public.event_match_log enable row level security;

-- No public select policy. Service role bypasses RLS as usual; the
-- admin UI uses the admin client.

-- ─── 4. Helper: list events that need scoring ─────────────────────────────
create or replace function public.list_unmatched_events(p_limit int default 20)
returns table (
  event_id    uuid,
  artist_slug text,
  starts_at   timestamptz
)
language sql
security definer  -- bypass RLS — cron needs to see all events
stable
as $$
  select e.id, e.artist_slug, e.starts_at
  from public.artist_events e
  where e.match_processed_at is null
    and e.active = true
    and (e.starts_at is null or e.starts_at > now())
  order by coalesce(e.starts_at, now() + interval '90 days') asc
  limit p_limit;
$$;

comment on function public.list_unmatched_events is
  'Events that have been created but not yet scored for the
   smart-match notification flow. Cron picks these up on a schedule
   and pre-computes event_match_log rows so the admin sees a ready
   candidate list when they open the preview page.';

grant execute on function public.list_unmatched_events to anon, authenticated;

comment on column public.artist_events.match_processed_at is
  'Set by /api/cron/event-match-prepare once candidates have been
   scored and saved into event_match_log. NULL = pending scoring.';

comment on table public.event_match_log is
  'Audit log of who got considered for an event-match notification,
   what their score components were, and which channels (in-app /
   SMS) actually fired. is_candidate = true means they made the top
   25% cap; sent_at is non-null once admin clicked Send.';
