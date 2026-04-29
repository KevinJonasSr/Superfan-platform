import Link from "next/link";

export const metadata = {
  title: "For Artists · Fan Engage",
  description:
    "Your fan club without the streaming middleman. Apply to bring your artist hub to Fan Engage.",
};

export default function ForArtistsPage() {
  return (
    <main className="mx-auto max-w-5xl space-y-16 px-6 py-16">
      <section className="space-y-6 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-white/60">
          For Artists
        </p>
        <h1
          className="text-5xl font-semibold leading-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Your fan club without the middleman.
        </h1>
        <p className="mx-auto max-w-2xl text-base text-white/75">
          Fan Engage is a direct-to-fan platform for artists. Drops, founder
          tiers, AI-drafted comment replies, smart event-match notifications,
          and a weekly digest that goes straight to your fans&apos; inboxes —
          your audience, your data, your terms.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
          <Link
            href="/for-artists/apply"
            className="rounded-full bg-gradient-to-r from-aurora to-ember px-6 py-3 text-sm font-semibold text-white shadow-glass transition hover:brightness-110"
          >
            Apply to join →
          </Link>
          <Link
            href="/artists"
            className="rounded-full border border-white/30 px-6 py-3 text-sm font-medium text-white/80 hover:bg-white/10"
          >
            See active artists
          </Link>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {[
          {
            title: "Drops & founder tiers",
            body: "Limited-edition merch, early-access tickets, founder-only experiences. Cap your founders at 100 and let the rest stack points toward the next tier.",
          },
          {
            title: "AI-drafted comment replies",
            body: "Your fans comment, you reply at scale. Claude drafts your tone-perfect response — keep them, edit them, ignore them.",
          },
          {
            title: "Smart event matching",
            body: "When a tour date drops, fans within driving distance get a notification with their best route. Conversion-grade.",
          },
        ].map((card) => (
          <div
            key={card.title}
            className="glass-card rounded-2xl p-6"
          >
            <p className="text-sm font-semibold">{card.title}</p>
            <p className="mt-2 text-xs text-white/65">{card.body}</p>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-amber-500/15 via-black to-aurora/15 p-10 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-white/60">
          The Process
        </p>
        <h2
          className="mt-3 text-3xl font-semibold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Three steps from application to live artist
        </h2>
        <ol className="mx-auto mt-8 grid max-w-3xl gap-4 text-left text-sm text-white/80 md:grid-cols-3">
          <li className="rounded-2xl bg-white/5 p-5">
            <span className="text-xs uppercase tracking-wide text-aurora">
              1. Apply
            </span>
            <p className="mt-2 font-medium">
              Tell us about your music, your fans, and what you want a fan
              club to look like.
            </p>
          </li>
          <li className="rounded-2xl bg-white/5 p-5">
            <span className="text-xs uppercase tracking-wide text-aurora">
              2. Review
            </span>
            <p className="mt-2 font-medium">
              We respond within 48 hours. If you&apos;re a fit we&apos;ll
              schedule a call with you and your manager.
            </p>
          </li>
          <li className="rounded-2xl bg-white/5 p-5">
            <span className="text-xs uppercase tracking-wide text-aurora">
              3. Onboard
            </span>
            <p className="mt-2 font-medium">
              Guided setup wizard: hero image, first drop, first community
              post, connect your tools, go live.
            </p>
          </li>
        </ol>
        <div className="mt-10">
          <Link
            href="/for-artists/apply"
            className="rounded-full bg-gradient-to-r from-aurora to-ember px-6 py-3 text-sm font-semibold text-white shadow-glass transition hover:brightness-110"
          >
            Apply to join →
          </Link>
        </div>
      </section>
    </main>
  );
}
