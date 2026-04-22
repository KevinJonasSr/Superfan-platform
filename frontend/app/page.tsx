import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import FanHomeDashboard from "@/components/fan-home-dashboard";
import InviteQRCode from "@/components/invite-qr";
import { getCurrentFan, getCurrentFanKpis } from "@/lib/data/fan";
import { getFanHomeData } from "@/lib/data/fan-home";
import { getFeaturedOffers } from "@/lib/data/offers";
import { getTiers, tierIcon } from "@/lib/data/tiers";
import type { TierSlug } from "@/lib/data/types";

// ─── Static preview content (shown when the viewer isn't signed in) ────────
const fallbackKpis = [
  { label: "Total Points", value: "12,450", delta: "+320 today" },
  { label: "Referrals", value: "38", delta: "+4 this week" },
  { label: "Badges", value: "12", delta: "2 new" },
  { label: "Next Reward", value: "VIP Soundcheck", delta: "Unlocks at 15k" },
];

const journeyCards = [
  { title: "Complete Backstage Challenge", points: "+250 pts" },
  { title: "Share Your Listening Story", points: "+150 pts" },
  { title: "Vote in Today’s Poll", points: "+75 pts" },
];

const events = [
  { title: "Austin Listening Party", detail: "RSVP closes in 12h", date: "Apr 02" },
  { title: "NYC Soundcheck", detail: "VIP access only", date: "Apr 07" },
];

const fallbackOffers = [
  { title: "Signed Vinyl + Poster", tier: "Gold Exclusive", points: "4,500 pts" },
  { title: "Backstage Experience", tier: "Platinum Drop", points: "10,000 pts" },
  { title: "Limited Hoodie", tier: "Silver Priority", points: "3,200 pts" },
];

const quickActions: { label: string; href: string }[] = [
  { label: "Share referral link", href: "/referrals" },
  { label: "Browse marketplace", href: "/marketplace" },
  { label: "Check rewards", href: "/rewards" },
  { label: "Invite a friend", href: "/onboarding" },
];

function formatPts(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US").format(n) + " pts";
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  // Supabase's default email templates point the confirmation link at
  // `{SITE_URL}?code=...` — i.e., the root — instead of `/auth/callback`.
  // Forward any code to the real callback route so sessions actually complete.
  const params = await searchParams;
  if (params.code) {
    redirect(`/auth/callback?code=${encodeURIComponent(params.code)}&next=/onboarding`);
  }

  // Kick off all queries in parallel. They each gracefully return
  // null / empty on any error, so the page never breaks.
  const [fan, kpis, featured, tiers, fanHome] = await Promise.all([
    getCurrentFan(),
    getCurrentFanKpis(),
    getFeaturedOffers(3),
    getTiers(),
    getFanHomeData(),
  ]);

  // Build the KPI grid. If we have a real KPI row, use it; otherwise the
  // preview content above.
  const kpiCards = kpis
    ? [
        {
          label: "Total Points",
          value: new Intl.NumberFormat("en-US").format(kpis.total_points),
          delta: "",
        },
        { label: "Referrals", value: String(kpis.referral_count), delta: "" },
        { label: "Badges", value: String(kpis.badge_count), delta: "" },
        {
          label: "Next Reward",
          value: kpis.next_tier?.display_name ?? "Max tier",
          delta:
            kpis.points_to_next_tier != null
              ? `${formatPts(kpis.points_to_next_tier)} to go`
              : "",
        },
      ]
    : fallbackKpis;

  // Show a "Finish profile" nudge when signed-in users have no first_name yet.
  const needsProfile = fan !== null && !fan.first_name;
  const isSignedIn = fan !== null;

  // Featured offers: DB when signed-in (empty state if none), static preview
  // for signed-out visitors only. Stops fake "4,500 pts Signed Vinyl" from
  // appearing as if it's real inventory.
  const offers =
    featured.length > 0
      ? featured.map((o) => ({
          title: o.title,
          tier: `${o.min_tier[0].toUpperCase() + o.min_tier.slice(1)}`,
          points: o.price_points ? formatPts(o.price_points) : `$${(o.price_cents ?? 0) / 100}`,
        }))
      : isSignedIn
        ? []
        : fallbackOffers;

  // Tier journey card — use real tier + fan's current status if available.
  const currentTier = (fan?.current_tier ?? "bronze") as TierSlug;

  // Build the invite URL for signed-in fans (used by the QR card).
  const headerList = await headers();
  const host =
    process.env.NEXT_PUBLIC_APP_URL ??
    (headerList.get("x-forwarded-host") ?? headerList.get("host"));
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  const origin = host?.startsWith("http") ? host : `${proto}://${host}`;
  const inviteUrl = fan?.referral_code
    ? `${origin}/invite/${fan.referral_code}`
    : null;

  return (
    <div className="min-h-screen bg-midnight">
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12 lg:flex-row">
        <div className="flex-1 space-y-6">
          {needsProfile && (
            <section className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-aurora/40 bg-gradient-to-r from-aurora/20 via-slate-900 to-ember/20 px-5 py-4">
              <div>
                <p className="text-sm font-semibold">Finish setting up your profile</p>
                <p className="text-xs text-white/70">
                  Takes less than a minute — unlocks your referral code, SMS alerts, and a signup bonus.
                </p>
              </div>
              <Link
                href="/onboarding"
                className="rounded-full bg-gradient-to-r from-aurora to-ember px-4 py-2 text-sm font-semibold text-white shadow-glass transition hover:brightness-110"
              >
                Complete profile
              </Link>
            </section>
          )}
          {/* Personalized Fan Home dashboard — only for signed-in fans with a
              finished profile. Falls through to the static preview content
              below otherwise. */}
          {isSignedIn && !needsProfile && fanHome && (
            <FanHomeDashboard data={fanHome} />
          )}
          <section className="glass-card p-6">
            <p className="flex items-center gap-2 text-sm uppercase tracking-wide text-white/60">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/20 text-amber-300">
                ★
              </span>
              {fan?.first_name ? `Welcome back, ${fan.first_name}` : "Fan Momentum"}
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {kpiCards.map((kpi) => (
                <div key={kpi.label} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <p className="text-xs uppercase tracking-wide text-white/50">{kpi.label}</p>
                  <p className="mt-2 text-2xl font-semibold">{kpi.value}</p>
                  {kpi.delta && <p className="text-sm text-emerald-300">{kpi.delta}</p>}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-purple-800/30 via-slate-900 to-midnight p-6 shadow-glass">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-wide text-white/60">Continue Your Journey</p>
                <h2 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                  Keep the momentum going
                </h2>
              </div>
              <Link
                href="/rewards"
                className="inline-flex items-center gap-2 rounded-full border border-white/30 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/10"
              >
                View Missions <span>➜</span>
              </Link>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {journeyCards.map((card) => (
                <article key={card.title} className="rounded-2xl bg-white/10 p-4">
                  <p className="text-sm text-white/70">{card.title}</p>
                  <p className="mt-3 text-lg font-semibold text-emerald-300">{card.points}</p>
                  <button className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-white">
                    Start <span>→</span>
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="glass-card space-y-4 p-6">
              <p className="flex items-center gap-2 text-sm uppercase tracking-wide text-white/60">
                <span>📅</span> Upcoming Events
              </p>
              {isSignedIn ? (
                <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-6 text-center text-xs text-white/60">
                  No events scheduled yet. Artist drops and listening parties will show here.
                </div>
              ) : (
                events.map((event) => (
                  <div
                    key={event.title}
                    className="flex items-center justify-between rounded-2xl bg-black/30 p-4"
                  >
                    <div>
                      <p className="text-sm font-semibold">{event.title}</p>
                      <p className="text-xs text-white/60">{event.detail}</p>
                    </div>
                    <span className="text-sm font-medium text-white/70">{event.date}</span>
                  </div>
                ))
              )}
            </div>
            <div className="glass-card space-y-4 p-6">
              <p className="flex items-center gap-2 text-sm uppercase tracking-wide text-white/60">
                <span>🎁</span> Recommended Offers
              </p>
              {offers.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-6 text-center text-xs text-white/60">
                  No offers right now. Check back — new drops appear here automatically.
                </div>
              ) : (
                offers.map((offer) => (
                  <div key={offer.title} className="rounded-2xl bg-black/30 p-4">
                    <p className="text-sm font-semibold">{offer.title}</p>
                    <p className="text-xs uppercase tracking-wide text-white/50">{offer.tier}</p>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-lg font-semibold text-emerald-300">
                        {offer.points}
                      </span>
                      <Link
                        href="/marketplace"
                        className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="glass-card p-6">
            <p className="flex items-center gap-2 text-sm uppercase tracking-wide text-white/60">
              <span>🏆</span> Quick Actions
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {quickActions.map((action) => (
                <Link
                  key={action.label}
                  href={action.href}
                  className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-medium text-white/80 transition hover:border-white/30 hover:bg-white/10"
                >
                  {action.label}
                </Link>
              ))}
            </div>
          </section>
        </div>

        <aside className="w-full max-w-sm space-y-6">
          <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-amber-400/30 via-black to-aurora/30 p-6 text-white shadow-glass">
            <p className="text-sm uppercase tracking-wide text-white/70">Tier Journey</p>
            <h3 className="mt-2 text-xl font-semibold">
              {kpis?.next_tier
                ? `${tiers.find((t) => t.slug === currentTier)?.display_name ?? "Bronze"} · ${formatPts(
                    kpis.points_to_next_tier,
                  )} to ${kpis.next_tier.display_name}`
                : "Your tier at a glance"}
            </h3>
            <div className="mt-6 space-y-4">
              {tiers.map((tier) => {
                const unlocked =
                  kpis != null && kpis.total_points >= tier.min_points;
                const isCurrent = tier.slug === currentTier;
                return (
                  <div
                    key={tier.slug}
                    className={`flex items-center justify-between rounded-2xl px-4 py-3 ${
                      isCurrent ? "bg-white/15" : "bg-black/30"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span>{tierIcon(tier.slug)}</span>
                      {tier.display_name}
                    </span>
                    <span className="text-xs uppercase tracking-wide text-white/50">
                      {unlocked ? "Unlocked" : `${formatPts(tier.min_points)}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {inviteUrl ? (
            <section className="glass-card p-6">
              <p className="text-sm uppercase tracking-wide text-white/60">Your invite</p>
              <p className="mt-2 text-xs text-white/60">
                Share the QR for instant sign-ups. Every verified join earns you 150 pts.
              </p>
              <div className="mt-4">
                <InviteQRCode url={inviteUrl} />
              </div>
              <Link
                href="/referrals"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
              >
                Open referrals →
              </Link>
            </section>
          ) : !isSignedIn ? (
            <section className="glass-card p-6">
              <p className="text-sm uppercase tracking-wide text-white/60">Your invite</p>
              <p className="mt-2 text-xs text-white/60">
                Create an account to unlock your personal referral QR code and earn points for every friend who joins.
              </p>
              <Link
                href="/signup"
                className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-aurora to-ember px-4 py-2 text-sm font-semibold text-white shadow-glass transition hover:brightness-110"
              >
                Create account
              </Link>
            </section>
          ) : null}
        </aside>
      </main>
    </div>
  );
}
