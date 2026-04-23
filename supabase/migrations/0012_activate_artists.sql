-- ────────────────────────────────────────────────────────────────────────────
-- Fan Engage — Phase 4c+: activate Danger Twins, Dan Marshall, Hunter Hawkins
--
-- Updates the `communities` rows (seeded inactive in 0011) to active=true
-- with brand accent colors + placeholder taglines so the marketing landing
-- and /admin/communities switcher show them immediately. Also seeds matching
-- rows in the legacy `artists` table so the existing listArtistsFromDb()
-- pipeline surfaces them on /artists without code changes.
--
-- Street Team + Nellie's stay inactive — Kevin wants those on a later phase.
--
-- Safe to re-run (idempotent).
-- ────────────────────────────────────────────────────────────────────────────

-- ─── 1. Activate communities + set branding ───────────────────────────────

update public.communities set
  active       = true,
  tagline      = 'Indie soul, sharpened by the Twins.',
  accent_from  = '#ec4899',
  accent_to    = '#7c2d92'
where slug = 'danger-twins';

update public.communities set
  active       = true,
  tagline      = 'Heartland heart, modern punch.',
  accent_from  = '#f59e0b',
  accent_to    = '#ea580c'
where slug = 'dan-marshall';

update public.communities set
  active       = true,
  tagline      = 'Country with grit and gospel.',
  accent_from  = '#14b8a6',
  accent_to    = '#2563eb'
where slug = 'hunter-hawkins';


-- ─── 2. Seed matching artists rows ────────────────────────────────────────
-- Keeps the existing Fan Engage surfaces (marketing landing, /artists list,
-- follow button) picking these up without code changes. When the full
-- community-scoped refactor lands, this table becomes a cache / view over
-- communities; for now it stays as an independent row per artist.

insert into public.artists
  (slug, name, tagline, bio, accent_from, accent_to, genres, social, active, sort_order)
values
  ('danger-twins', 'Danger Twins',
   'Indie soul, sharpened by the Twins.',
   'Placeholder bio — awaiting final copy from the artist team.',
   '#ec4899', '#7c2d92',
   array['Indie','Soul','Pop']::text[],
   '[]'::jsonb,
   true, 2),
  ('dan-marshall', 'Dan Marshall',
   'Heartland heart, modern punch.',
   'Placeholder bio — awaiting final copy from the artist team.',
   '#f59e0b', '#ea580c',
   array['Country','Rock','Heartland']::text[],
   '[]'::jsonb,
   true, 3),
  ('hunter-hawkins', 'Hunter Hawkins',
   'Country with grit and gospel.',
   'Placeholder bio — awaiting final copy from the artist team.',
   '#14b8a6', '#2563eb',
   array['Country','Gospel','Roots']::text[],
   '[]'::jsonb,
   true, 4)
on conflict (slug) do update set
  name         = excluded.name,
  tagline      = excluded.tagline,
  accent_from  = excluded.accent_from,
  accent_to    = excluded.accent_to,
  genres       = excluded.genres,
  active       = true;


-- ─── 3. Smoke-test queries ────────────────────────────────────────────────
-- select slug, display_name, active, tagline from communities
--   where type = 'artist' order by sort_order;
-- -- Expected: 4 active rows (raelynn, danger-twins, dan-marshall, hunter-hawkins).
--
-- select slug, name, active, sort_order from artists order by sort_order;
-- -- Expected: raelynn active + 3 new rows active.
