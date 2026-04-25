import Link from "next/link";
import type { FanHomeData } from "@/lib/data/fan-home";

/**
 * Personalized Fan Home dashboard — everything a signed-in fan sees at /
 * above the existing marketing content. All data comes from getFanHomeData()
 * so there are no client-side fetches here.
 */
export default function FanHomeDashboard({ data }: { data: FanHomeData }) {
  const {
    fan,
    followedArtists,
    nextEvent,
    ctas,
    recentActivity,
    badgesInProgress,
    premiumCommunities,
    founderCommunities,
  } = data;

  // Pick the first community for the rewards link (or fallback)
  const primaryCommunity = followedArtists[0]?.slug || "raelynn";

  return (
    <section className="space-y-6">
      {/* Greeting + quick stats */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-white/60">
            Welcome back{fan.first_name ? `, ${fan.first_name.split(" ")[0]}` : ""}
          </p>
          <h1
            className="mt-2 text-3xl font-semibold"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Your fan club
          </h1>
        </div>
      </header>

      {/* Followed artists strip */}
      <FollowedArtistsStrip artists={followedArtists} />

      {/* Next event */}
      {nextEvent && <NextEventCard event={nextEvent} />}

      {/* Active CTAs */}
      <ActiveCtasBlock ctas={ctas} />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent activity */}
        <RecentActivityFeed
          posts={recentActivity}
          premiumCommunities={premiumCommunities}
          founderCommunities={founderCommunities}
        />

        {/* Badges in progress */}
        <BadgesInProgressPanel items={badgesInProgress} />
      </div>

      {/* Spend your points card */}
      <SpendPointsCard primaryCommunity={primaryCommunity} points={fan.total_points} />
    </section>
  );
}

function FollowedArtistsStrip({
  artists,
}: {
  artists: FanHomeData["followedArtists"];
}) {
  if (artists.length === 0) {
    return (
      <div className="glass-card p-5">
        <p className="text-sm font-semibold">Follow your favorite artists</p>
        <p className="mt-2 text-xs text-white/60">
          Tap an artist, hit <span className="text-white">+ Follow</span>, and you&apos;ll get
          their posts, events, and drops here.
        </p>
        <Link
          href="/artists"
          className="mt-3 inline-flex rounded-full border border-white/20 px-3 py-1 text-xs text-white/80 hover:bg-white/10"
        >
          Browse artists →
        </Link>
      </div>
    );
  }

  return (
    <div className="glass-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-white/60">
          Following · {artists.length}
        </p>
        <Link href="/artists" className="text-xs text-white/60 hover:text-white">
          Add more →
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {artists.map((a) => (
          <Link
            key={a.slug}
            href={`/artists/${a.slug}`}
            className="group flex w-36 shrink-0 flex-col items-center gap-2 rounded-2xl border border-white/10 p-3 transition hover:border-white/30"
          >
            {/* Artist card — simplified for brevity */}
            <p className="text-xs font-semibold text-center">{a.name}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function NextEventCard({ event }: { event: any }) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <p className="text-xs uppercase tracking-wide text-white/60">Next event</p>
      <p className="mt-2 font-semibold">{event.title}</p>
      <Link
        href={`/artists/${event.artist_slug}/events`}
        className="mt-3 inline-flex text-xs text-blue-400 hover:text-blue-300"
      >
        View details →
      </Link>
    </div>
  );
}

function ActiveCtasBlock({ ctas }: { ctas: any[] }) {
  if (ctas.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {ctas.map((cta) => (
        <Link
          key={cta.id}
          href={cta.url || "#"}
          className="glass-card group flex items-center gap-3 rounded-2xl p-4 transition hover:border-white/20"
        >
          <div className="text-xl">{cta.icon}</div>
          <div>
            <p className="text-xs font-semibold">{cta.title}</p>
            <p className="text-xs text-white/60">{cta.description}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

function RecentActivityFeed({
  posts,
  premiumCommunities,
  founderCommunities,
}: {
  posts: any[];
  premiumCommunities: string[];
  founderCommunities: string[];
}) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <p className="text-xs uppercase tracking-wide text-white/60">Recent activity</p>
      <div className="mt-4 space-y-3">
        {posts.length > 0
          ? posts.slice(0, 3).map((post) => (
              <div key={post.id} className="border-b border-white/5 pb-3 last:border-0">
                <p className="text-xs font-semibold line-clamp-2">{post.title}</p>
              </div>
            ))
          : null}
      </div>
    </div>
  );
}

function BadgesInProgressPanel({ items }: { items: any[] }) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <p className="text-xs uppercase tracking-wide text-white/60">Badges in progress</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {items.length > 0
          ? items.slice(0, 4).map((badge) => (
              <div
                key={badge.slug}
                className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-[10px]"
              >
                {badge.icon} {badge.name}
              </div>
            ))
          : null}
      </div>
    </div>
  );
}

function SpendPointsCard({
  primaryCommunity,
  points,
}: {
  primaryCommunity: string;
  points: number;
}) {
  return (
    <div className="glass-card rounded-2xl p-5 border border-gradient-to-r from-purple-500/30 to-blue-500/30">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-white/60">Spend your points</p>
          <p className="mt-1 text-sm font-semibold">{points.toLocaleString()} available</p>
        </div>
        <Link
          href={`/artists/${primaryCommunity}/rewards`}
          className="inline-flex rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 px-4 py-2 text-xs font-medium text-white hover:opacity-90"
        >
          Browse rewards →
        </Link>
      </div>
    </div>
  );
}
