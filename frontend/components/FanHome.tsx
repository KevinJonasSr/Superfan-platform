import { FanHomeData } from "../data/fanHome";

interface FanHomeProps {
  data: FanHomeData;
}

export function FanHome({ data }: FanHomeProps) {
  return (
    <div className="min-h-screen bg-midnight">
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12 lg:flex-row">
        <div className="flex-1 space-y-6">
          <section className="glass-card p-6">
            <p className="flex items-center gap-2 text-sm uppercase tracking-wide text-white/60">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/20 text-amber-300">
                ★
              </span>
              {data.heroLabel}
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {data.kpis.map((kpi) => (
                <div key={kpi.label} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <p className="text-xs uppercase tracking-wide text-white/50">{kpi.label}</p>
                  <p className="mt-2 text-2xl font-semibold">{kpi.value}</p>
                  <p className="text-sm text-emerald-300">{kpi.delta}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-purple-800/30 via-slate-900 to-midnight p-6 shadow-glass">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-wide text-white/60">{data.heroTitle}</p>
                <h2 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                  {data.heroSubtitle}
                </h2>
                {data.heroBadge ? (
                  <p className="mt-2 text-xs uppercase tracking-wide text-amber-300/80">
                    {data.heroBadge}
                  </p>
                ) : null}
              </div>
              <button className="inline-flex items-center gap-2 rounded-full border border-white/30 px-4 py-2 text-sm font-medium text-white/80">
                View Missions <span>➜</span>
              </button>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {data.journeyCards.map((card) => (
                <article key={card.title} className="rounded-2xl bg-white/10 p-4">
                  <p className="text-sm text-white/70">{card.title}</p>
                  <p className="mt-3 text-lg font-semibold text-emerald-300">{card.points}</p>
                  <button className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-white">
                    {card.cta ?? "Start"} <span>→</span>
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
              {data.events.map((event) => (
                <div key={event.title} className="flex items-center justify-between rounded-2xl bg-black/30 p-4">
                  <div>
                    <p className="text-sm font-semibold">{event.title}</p>
                    <p className="text-xs text-white/60">{event.detail}</p>
                  </div>
                  <span className="text-sm font-medium text-white/70">{event.date}</span>
                </div>
              ))}
            </div>
            <div className="glass-card space-y-4 p-6">
              <p className="flex items-center gap-2 text-sm uppercase tracking-wide text-white/60">
                <span>🎁</span> Recommended Offers
              </p>
              {data.offers.map((offer) => (
                <div key={offer.title} className="rounded-2xl bg-black/30 p-4">
                  <p className="text-sm font-semibold">{offer.title}</p>
                  <p className="text-xs uppercase tracking-wide text-white/50">{offer.tier}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-lg font-semibold text-emerald-300">{offer.points}</span>
                    <button className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium">Redeem</button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="glass-card p-6">
            <p className="flex items-center gap-2 text-sm uppercase tracking-wide text-white/60">
              <span>🏆</span> Quick Actions
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {data.quickActions.map((action) => (
                <button
                  key={action}
                  className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-medium text-white/80"
                >
                  {action}
                </button>
              ))}
            </div>
          </section>

          <section className="glass-card p-6">
            <p className="flex items-center gap-2 text-sm uppercase tracking-wide text-white/60">
              <span>🛟</span> Support & Policies
            </p>
            <div className="mt-4 space-y-4">
              <p className="max-w-3xl text-sm leading-6 text-white/70">
                {data.supportNote ??
                  "This is a preview of the live dashboard. Support, contact, privacy, and terms belong in the footer so fans can get help without hunting for it."}
              </p>
              <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.2em] text-white/45">
                {["Help center", "Contact", "Privacy", "Terms"].map((item) => (
                  <span key={item} className="rounded-full border border-white/10 bg-black/20 px-3 py-2">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </section>
        </div>

        <aside className="w-full max-w-sm space-y-6">
          <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-amber-400/30 via-black to-aurora/30 p-6 text-white shadow-glass">
            <p className="text-sm uppercase tracking-wide text-white/70">Tier Journey</p>
            <h3 className="mt-2 text-xl font-semibold">
              {data.heroTitle.includes(" · ") ? data.heroTitle : `${data.heroTitle} · Progress`}
            </h3>
            <div className="mt-6 space-y-4">
              {data.tiers.map((tier) => (
                <div key={tier.label} className="flex items-center justify-between rounded-2xl bg-black/30 px-4 py-3">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <span>{tier.icon}</span>
                    {tier.label}
                  </span>
                  <span className="text-xs uppercase tracking-wide text-white/50">{tier.status}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="glass-card p-6">
            <p className="text-sm uppercase tracking-wide text-white/60">Mobile Snapshot</p>
            <div className="mt-4 h-80 rounded-2xl bg-gradient-to-b from-purple-700/40 to-black/60" />
            <p className="mt-3 text-xs text-white/60">{data.mobileNote}</p>
          </section>
        </aside>
      </main>
    </div>
  );
}
