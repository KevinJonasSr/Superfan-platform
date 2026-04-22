-- ────────────────────────────────────────────────────────────────────────────
-- Fan Engage — Phase 3d: legal + compliance infrastructure
-- Safe to re-run (idempotent).
-- Apply via: Supabase dashboard → SQL Editor → paste → Run.
-- ────────────────────────────────────────────────────────────────────────────

-- ─── Policy pages (ToS, Privacy, Cookie) — admin-editable markdown ────────
create table if not exists public.policy_pages (
  slug            text primary key,
  title           text not null,
  content_md      text not null default '',
  effective_date  date,
  is_draft        boolean not null default true,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.fans(id) on delete set null
);

drop trigger if exists policy_pages_set_updated_at on public.policy_pages;
create trigger policy_pages_set_updated_at
  before update on public.policy_pages
  for each row execute function public.set_updated_at();

-- ─── Seed placeholder pages (upsert; safe to re-run) ──────────────────────
-- Placeholder markdown is clearly flagged as DRAFT so nobody confuses it
-- with real legal copy. Admins paste the final text via /admin/policies
-- once counsel delivers it.
insert into public.policy_pages (slug, title, content_md, is_draft) values
  ('terms', 'Terms of Service',
   E'# Terms of Service — DRAFT\n\n_This is a placeholder. Final terms pending legal review._\n\n' ||
   E'## 1. Acceptance of terms\nBy using Fan Engage you agree to these terms.\n\n' ||
   E'## 2. Eligibility\nYou must be 13 years or older to use Fan Engage.\n\n' ||
   E'## 3. Account + conduct\nYou are responsible for keeping your account secure and for everything you post.\n\n' ||
   E'## 4. Content + intellectual property\nYou retain rights to your content; you grant Fan Engage a license to display it within the platform.\n\n' ||
   E'## 5. Points + rewards\nPoints have no cash value and cannot be transferred between accounts.\n\n' ||
   E'## 6. Termination\nFan Engage may suspend or terminate accounts that violate these terms.\n\n' ||
   E'## 7. Contact\nQuestions? Email support@fanengage.app.',
   true),
  ('privacy', 'Privacy Policy',
   E'# Privacy Policy — DRAFT\n\n_This is a placeholder. Final policy pending legal review._\n\n' ||
   E'## 1. Information we collect\nWe collect the information you provide at signup: email, phone number, first name, city, and your opt-in choices for SMS and email.\n\n' ||
   E'## 2. How we use it\n- To send you opted-in communications about your chosen artists\n- To track points, badges, referrals, and RSVPs\n- To improve the platform\n\n' ||
   E'## 3. Sharing\nWe do not sell your data. We share it only with service providers (Supabase, Mailchimp, Twilio) as needed to operate the platform.\n\n' ||
   E'## 4. Your rights\nYou can request data export or account deletion at any time by emailing support@fanengage.app.\n\n' ||
   E'## 5. Cookies\nSee our Cookie Policy for details about cookies and local storage.\n\n' ||
   E'## 6. Contact\nPrivacy questions? Email privacy@fanengage.app.',
   true),
  ('cookie_policy', 'Cookie Policy',
   E'# Cookie Policy — DRAFT\n\n_This is a placeholder. Final policy pending legal review._\n\n' ||
   E'## What we use\n- **Authentication cookies** — set by Supabase when you sign in\n- **Referral cookie** (`fanengage_ref`) — 30-day cookie tracking invite codes\n- **Local storage** — remembering that you dismissed the cookie banner and caching lightweight UI state\n\n' ||
   E'## What we don''t use\nWe don''t use advertising cookies, third-party trackers, or analytics cookies tied to individual users.\n\n' ||
   E'## Your choices\nYou can clear cookies from your browser at any time. Signed-in features won''t work without authentication cookies.',
   true)
on conflict (slug) do update set
  title = excluded.title,
  -- Only overwrite content when the existing row is still the placeholder
  -- draft — so re-running the migration never clobbers real legal copy.
  content_md = case when policy_pages.is_draft and policy_pages.content_md like '%DRAFT%'
                   then excluded.content_md else policy_pages.content_md end;

-- ─── Fan consent + unsubscribe token ──────────────────────────────────────
alter table public.fans
  add column if not exists consent_accepted_at timestamptz,
  add column if not exists consent_version     text,
  add column if not exists unsubscribe_token   text;

-- Backfill unsubscribe_token for existing fans (random 32 hex chars)
update public.fans
  set unsubscribe_token = encode(gen_random_bytes(16), 'hex')
  where unsubscribe_token is null;

-- From now on new fans get one automatically
alter table public.fans
  alter column unsubscribe_token set default encode(gen_random_bytes(16), 'hex');

create unique index if not exists fans_unsubscribe_token_idx
  on public.fans (unsubscribe_token);

-- ─── RLS ──────────────────────────────────────────────────────────────────
alter table public.policy_pages enable row level security;

-- Everyone (signed-in or not) can read policy pages — so /terms and /privacy
-- render for anonymous visitors before signup.
drop policy if exists policy_pages_public_read on public.policy_pages;
create policy policy_pages_public_read on public.policy_pages
  for select using (true);

-- Writes via admin service role only.

-- ─── Smoke test ────────────────────────────────────────────────────────────
-- select slug, title, is_draft, effective_date from policy_pages;
-- select count(*) as fans_with_token from fans where unsubscribe_token is not null;
