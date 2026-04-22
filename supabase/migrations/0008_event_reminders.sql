-- ────────────────────────────────────────────────────────────────────────────
-- Fan Engage — Phase 3c: automated event reminders
-- Safe to re-run (idempotent).
-- Apply via: Supabase dashboard → SQL Editor → paste → Run.
-- ────────────────────────────────────────────────────────────────────────────

-- ─── Per-event reminder template override ─────────────────────────────────
alter table public.artist_events
  add column if not exists reminder_sms_template text;

-- ─── event_reminders (audit + de-dupe for scheduled sends) ────────────────
create table if not exists public.event_reminders (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.artist_events(id) on delete cascade,
  kind           text not null check (kind in ('reminder_24h', 'reminder_1h', 'manual')),
  sent_at        timestamptz not null default now(),
  recipients_sms integer not null default 0,
  recipients_email integer not null default 0,
  error          text
);

-- Prevent duplicate 24h + 1h fires per event (cron reruns are a no-op).
-- Manual sends intentionally allowed multiple times.
create unique index if not exists event_reminders_unique_scheduled
  on public.event_reminders (event_id, kind)
  where kind in ('reminder_24h', 'reminder_1h');

create index if not exists event_reminders_event_idx
  on public.event_reminders (event_id, sent_at desc);

-- ─── Row Level Security ────────────────────────────────────────────────────
alter table public.event_reminders enable row level security;

-- Admin-only reads/writes via service role. No policies exposed to fans.

-- ─── Smoke test ────────────────────────────────────────────────────────────
-- select * from event_reminders order by sent_at desc;
-- select column_name from information_schema.columns
--   where table_name='artist_events' and column_name='reminder_sms_template';
