import { getCurrentFan } from "@/lib/data/fan";
import { getMyReferrals, getReferralLeaderboard } from "@/lib/data/referrals";

const ladder = [
  { level: "1 referral", reward: "+150 pts" },
  { level: "3 referrals", reward: "Signed postcard" },
  { level: "5 referrals", reward: "Exclusive merch" },
  { level: "10 referrals", reward: "VIP livestream" },
];

const fallbackLeaderboard = [
  { name: "Alexis", total: "27 referrals" },
  { name: "Brandon", total: "21 referrals" },
  { name: "Maya", total: "18 referrals" },
  { name: "Theo", total: "16 referrals" },
];

function buildInviteUrl(code: string | null | undefined, origin = "fanengage.app"): string {
  if (!code) return `${origin}/invite/your-code`;
  return `${origin}/invite/${code}`;
}

export default async function ReferralsPage() {
  const [fan, myReferrals, leaderboard] = await Promise.all([
    getCurrentFan(),
    getMyReferrals(),
    getReferralLeaderboard(5),
  ]);

  const inviteUrl = buildInviteUrl(fan?.referral_code);
  const myCount = myReferrals.length;

  const leaderboardRows =
    leaderboard.length > 0
      ? leaderboard.map((row) => ({
          name: row.display_name,
          total: `${row.referral_count} referral${row.referral_count === 1 ? "" : "s"}`,
        }))
      : fallbackLeaderboard;

  return (
    <div className="min-h-screen bg-midnight">
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12 lg:flex-row">
        <div className="flex-1 space-y-6">
          <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-purple-800/30 via-slate-900 to-midnight p-6 shadow-glass">
            <p className="text-sm uppercase tracking-wide text-white/60">Referrals</p>
            <h1 className="mt-2 text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
              Turn friends into superfans
            </h1>
            <p className="mt-4 text-sm text-white/70">
              {fan
                ? `You've invited ${myCount} fan${myCount === 1 ? "" : "s"} so far. Keep sharing to climb the ladder.`
                : "Share your personal link to earn bonus points, badges, and early access rewards every time a friend joins."}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <code className="flex-1 rounded-2xl bg-black/40 px-4 py-3 text-sm">{inviteUrl}</code>
              <button className="rounded-full border border-white/30 px-4 py-2 text-sm text-white/80">
                Copy link
              </button>
            </div>
          </section>

          <section className="grid gap-6 md:grid-cols-2">
            <div className="glass-card p-6">
              <p className="text-sm uppercase tracking-wide text-white/60">Reward ladder</p>
              <div className="mt-4 space-y-4">
                {ladder.map((step) => (
                  <div key={step.level} className="rounded-2xl bg-black/30 px-4 py-3">
                    <p className="text-sm font-semibold">{step.level}</p>
                    <p className="text-xs text-white/60">{step.reward}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="glass-card p-6">
              <p className="text-sm uppercase tracking-wide text-white/60">Top referrers</p>
              <div className="mt-4 space-y-4">
                {leaderboardRows.map((entry, index) => (
                  <div key={entry.name} className="flex items-center justify-between rounded-2xl bg-black/30 px-4 py-3">
                    <span className="text-sm font-semibold">
                      #{index + 1} {entry.name}
                    </span>
                    <span className="text-xs uppercase tracking-wide text-white/60">{entry.total}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <aside className="w-full max-w-sm space-y-6">
          <section className="glass-card p-6">
            <p className="text-sm uppercase tracking-wide text-white/60">QR invite</p>
            <div className="mt-4 rounded-2xl bg-black/50 p-6 text-center text-white/60">
              QR placeholder
            </div>
            <p className="mt-3 text-xs text-white/60">
              {fan
                ? `Scan to join via ${fan.first_name ?? "your"}'s invite.`
                : "Scan to join the Fan Engage community via the current fan's invite."}
            </p>
          </section>

          <section className="glass-card p-6">
            <p className="text-sm uppercase tracking-wide text-white/60">Recent activity</p>
            <ul className="mt-4 space-y-3 text-sm text-white/70">
              {myReferrals.length > 0 ? (
                myReferrals.slice(0, 5).map((r) => (
                  <li key={r.id}>
                    • {r.referred_email ?? "Invite"} — {r.status}
                    {r.points_awarded ? ` (+${r.points_awarded} pts)` : ""}
                  </li>
                ))
              ) : (
                <>
                  <li>• Taylor accepted your invite 2 hours ago (+150 pts)</li>
                  <li>• Casey unlocked the Referral badge yesterday</li>
                  <li>• Devon claimed the Gold drop you shared</li>
                </>
              )}
            </ul>
          </section>
        </aside>
      </main>
    </div>
  );
}
