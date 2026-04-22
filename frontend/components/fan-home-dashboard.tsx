import Link from "next/link";
import type { FanHomeData } from "@/lib/data/fan-home";

/**
 * Personalized Fan Home dashboard — everything a signed-in fan sees at /
 * above the existing marketing content. All data comes from getFanHomeData()
 * so there are no client-side fetches here.
 */
export default function FanHomeDashboard({ data }: { data: FanHomeData }) {
  const { fan, followedArtists, nextEvent, ctas, recentActivity, badgesInProgress } =
    data;

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
        <RecentActivityFeed posts={recentActivity} />

        {/* Badges in progress */}
        <BadgesInProgressPanel items={badgesInProgress} />
      </div>
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
            style={{
              backgroundImage: `linear-gradient(to bottom right, ${a.accent_from}33, #0f172a, #000000)`,
            }}
          >
            {a.hero_image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={a.hero_image}
                alt=""
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <span
                className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-white"
                style={{
                  backgroundImage: `linear-gradient(to bottom right, ${a.accent_from}, ${a.accent_to})`,
                }}
              >
                {a.name.slice(0, 1)}
              </span>
            )}
            <p className="text-sm font-semibold">{a.name}</p>
            {a.tagline && (
              <p className="line-clamp-2 text-center text-[10px] text-white/60">
                {a.tagline}
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

function NextEventCard({ event }: { event: NonNullable<FanHomeData["nextEvent"]> }) {
  const countdown = event.starts_at ? formatCountdown(new Date(event.starts_at)) : null;

  return (
    <section className="rounded-3xl border border-rose-500/30 bg-gradient-to-br from-rose-900/30 via-slate-900 to-midnight p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-white/60">Next event</p>
          <h2
            className="mt-1 text-xl font-semibold"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {event.title}
          </h2>
          <p className="mt-1 text-sm text-white/70">
            {event.artist_name}
            {event.location ? ` · 📍 ${event.location}` : ""}
          </p>
          <p className="mt-2 text-xs text-white/50">
            {event.event_date ??
              (event.starts_at ? new Date(event.starts_at).toLocaleString() : "")}
          </p>
          {event.has_scheduled_reminder && (
            <p className="mt-2 text-[11px] text-emerald-300">
              ✓ Reminder scheduled · we&apos;ll text + email 24h + 1h before
            </p>
          )}
        </div>
        {countdown && (
          <div className="shrink-0 rounded-2xl bg-black/40 px-4 py-3 text-center">
            <p className="text-[10px] uppercase tracking-wide text-white/50">In</p>
            <p className="mt-1 text-2xl font-semibold">{countdown.value}</p>
            <p className="text-[10px] uppercase text-white/50">{countdown.unit}</p>
          </div>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
        <a
          href={`/api/events/${event.id}/ics`}
          className="rounded-full border border-white/20 px-3 py-1 text-white/80 hover:bg-white/10"
        >
          📅 Add to calendar
        </a>
        {event.url && (
          <a
            href={event.url}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-white/20 px-3 py-1 text-white/80 hover:bg-white/10"
          >
            Details ↗
          </a>
        )}
        <Link
          href={`/artists/${event.artist_slug}`}
          className="rounded-full bg-gradient-to-r from-aurora to-ember px-3 py-1 font-semibold text-white"
        >
          Open {event.artist_name ?? "artist page"} →
        </Link>
      </div>
    </section>
  );
}

function ActiveCtasBlock({ ctas }: { ctas: FanHomeData["ctas"] }) {
  const open = ctas.filter((c) => !c.completed);
  if (open.length === 0) return null;

  const ICON: Record<string, string> = {
    pre_save: "🎵",
    stream: "▶️",
    share: "🔁",
    radio_request: "📻",
    playlist_add: "➕",
    social_follow: "👥",
    custom: "✨",
  };

  return (
    <section className="rounded-3xl border border-purple-500/30 bg-gradient-to-br from-purple-900/30 via-slate-900 to-midnight p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-white/60">Earn points</p>
          <h2
            className="mt-1 text-xl font-semibold"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Active CTAs
          </h2>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {open.slice(0, 4).map((c) => (
          <Link
            key={c.id}
            href={`/artists/${c.artist_slug}/community`}
            className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/30 p-3 transition hover:border-white/30"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-lg">
              {ICON[c.kind] ?? "✨"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{c.title}</p>
              {c.artist_name && (
                <p className="text-[11px] uppercase tracking-wide text-white/50">
                  {c.artist_name}
                </p>
              )}
              <p className="mt-1 text-[11px] text-emerald-300">
                +{c.point_value} pts · {c.cta_label}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function RecentActivityFeed({ posts }: { posts: FanHomeData["recentActivity"] }) {
  return (
    <section className="glass-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-white/60">
          Recent activity
        </p>
      </div>
      {posts.length === 0 ? (
        <p className="mt-4 text-xs text-white/50">
          Follow artists to see their posts, polls, and challenges here.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {posts.map((p) => (
            <Link
              key={p.id}
              href={`/artists/${p.artist_slug}/community`}
              className="block rounded-xl bg-black/30 p-3 transition hover:bg-black/50"
            >
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/60">
                <span className="text-white">{p.artist_name ?? `/${p.artist_slug}`}</span>
                <KindChip kind={p.kind} />
                <span>· {timeAgo(p.created_at)}</span>
              </div>
              {p.title && <p className="mt-1 text-sm font-semibold">{p.title}</p>}
              <p className="mt-1 line-clamp-2 text-sm text-white/80">{p.body}</p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function BadgesInProgressPanel({
  items,
}: {
  items: FanHomeData["badgesInProgress"];
}) {
  return (
    <section className="glass-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-white/60">Badges in progress</p>
        <Link href="/rewards" className="text-xs text-white/60 hover:text-white">
          See all →
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="mt-4 text-xs text-white/50">
          You&apos;re all caught up or haven&apos;t started yet — dive into the community to
          unlock your next badge.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((b) => {
            const pct = Math.min(100, Math.round((b.progress / b.threshold) * 100));
            return (
              <div key={b.slug} className="rounded-xl bg-black/30 p-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-xl grayscale opacity-70">
                    {b.icon ?? "🏅"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{b.name}</p>
                    <p className="text-[11px] text-white/60">
                      +{b.point_value} pts · {b.progress} / {b.threshold}
                    </p>
                  </div>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-black/40">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-aurora to-ember"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function KindChip({ kind }: { kind: string }) {
  const toneMap: Record<string, string> = {
    post: "bg-white/10 text-white/70",
    announcement: "bg-sky-500/20 text-sky-200",
    poll: "bg-fuchsia-500/20 text-fuchsia-200",
    challenge: "bg-amber-500/20 text-amber-200",
  };
  const tone = toneMap[kind] ?? toneMap.post;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[9px] uppercase tracking-wide ${tone}`}
    >
      {kind}
    </span>
  );
}

function timeAgo(iso: string): string {
  const sec = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function formatCountdown(target: Date): { value: string; unit: string } {
  const diffMs = target.getTime() - Date.now();
  if (diffMs <= 0) return { value: "now", unit: "live" };
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return { value: String(minutes), unit: minutes === 1 ? "min" : "mins" };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { value: String(hours), unit: hours === 1 ? "hour" : "hours" };
  const days = Math.floor(hours / 24);
  return { value: String(days), unit: days === 1 ? "day" : "days" };
}
