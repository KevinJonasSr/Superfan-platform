import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { listArtists } from "@/lib/artists";
import {
  doesFanFollowArtist,
  getArtistFromDb,
} from "@/lib/data/artists";
import { getCurrentFan } from "@/lib/data/fan";
import FollowButton from "./follow-button";

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  // Static-params still uses the hardcoded list so builds don't need DB creds.
  // Runtime queries the DB and falls back to the same map on error.
  return listArtists().map((a) => ({ slug: a.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const artist = await getArtistFromDb(slug);
  if (!artist) return { title: "Artist · Fan Engage" };
  return {
    title: `${artist.name} · Fan Engage`,
    description: artist.tagline,
  };
}

export default async function ArtistPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [artist, fan, isFollowing] = await Promise.all([
    getArtistFromDb(slug),
    getCurrentFan(),
    doesFanFollowArtist(slug),
  ]);
  if (!artist) notFound();
  const isSignedIn = fan !== null;
  const needsProfile = isSignedIn && !fan.first_name;

  const heroGradient = `linear-gradient(to bottom right, ${artist.accentFrom}66, #0f172a, #000000)`;
  const ctaGradient = `linear-gradient(to right, ${artist.accentFrom}, ${artist.accentTo})`;

  // Primary CTA adapts to the viewer's state:
  // - anonymous  → "Join the fan club" → /onboarding?ref=<slug>
  // - signed in, no profile → "Complete profile" → /onboarding?ref=<slug>
  // - signed in, profile done → "Shop drops" → /marketplace
  const primaryCta = !isSignedIn
    ? { label: "Join the fan club", href: `/onboarding?ref=${artist.slug}` }
    : needsProfile
      ? { label: "Complete your profile", href: `/onboarding?ref=${artist.slug}` }
      : { label: "Shop drops", href: "/marketplace" };

  const secondaryCta = isSignedIn
    ? { label: "My rewards", href: "/rewards" }
    : { label: "See merchandise", href: "/marketplace" };

  return (
    <main className="mx-auto max-w-6xl space-y-10 px-6 py-12">
      {/* Hero */}
      <section
        className="relative overflow-hidden rounded-3xl border border-white/10 p-10"
        style={{ backgroundImage: heroGradient }}
      >
        <p className="text-xs uppercase tracking-[0.3em] text-white/60">
          {artist.genres.join(" · ")}
        </p>
        <h1
          className="mt-3 text-5xl font-semibold leading-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {artist.name}
        </h1>
        <p className="mt-3 max-w-xl text-lg text-white/80">{artist.tagline}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={primaryCta.href}
            className="rounded-full px-6 py-3 text-sm font-semibold text-white transition hover:brightness-110"
            style={{ backgroundImage: ctaGradient }}
          >
            {primaryCta.label}
          </Link>
          {isSignedIn && (
            <FollowButton artistSlug={artist.slug} initialFollowing={isFollowing} />
          )}
          <Link
            href={`/artists/${slug}/community`}
            className="rounded-full border border-white/30 px-6 py-3 text-sm font-medium text-white/80 hover:bg-white/10"
          >
            Community →
          </Link>
          <Link
            href={secondaryCta.href}
            className="rounded-full border border-white/30 px-6 py-3 text-sm font-medium text-white/80 hover:bg-white/10"
          >
            {secondaryCta.label}
          </Link>
        </div>
        {!artist.heroImage && (
          <p className="mt-6 text-xs text-white/40">
            Hero imagery pending Box asset drop.
          </p>
        )}
      </section>

      {/* About */}
      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="glass-card p-8">
          <p className="text-sm uppercase tracking-wide text-white/60">About</p>
          <p className="mt-4 text-base leading-relaxed text-white/80">{artist.bio}</p>
        </div>
        <div className="glass-card p-8">
          <p className="text-sm uppercase tracking-wide text-white/60">Follow</p>
          <ul className="mt-4 space-y-2 text-sm text-white/70">
            {artist.social.length === 0 ? (
              <li className="text-white/40">Social links pending.</li>
            ) : (
              artist.social.map((s) => (
                <li key={s.label}>
                  <a href={s.href} className="hover:text-white" rel="noreferrer" target="_blank">
                    {s.label} →
                  </a>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      {/* Upcoming */}
      <section className="glass-card p-8">
        <p className="text-sm uppercase tracking-wide text-white/60">Upcoming</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {artist.upcoming.map((e) => (
            <div key={e.title} className="rounded-2xl bg-black/30 p-5">
              <p className="text-sm font-semibold">{e.title}</p>
              <p className="text-xs text-white/60">{e.detail}</p>
              <p className="mt-3 text-xs uppercase tracking-wide text-white/40">{e.date}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Merch */}
      <section className="glass-card p-8">
        <p className="text-sm uppercase tracking-wide text-white/60">Fan club rewards</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {artist.merch.map((m) => (
            <div key={m.title} className="rounded-2xl bg-black/30 p-5">
              <p className="text-xs uppercase tracking-wide text-white/50">{m.tier}</p>
              <p className="mt-1 text-sm font-semibold">{m.title}</p>
              <p className="mt-3 text-sm font-semibold text-emerald-300">{m.points}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
