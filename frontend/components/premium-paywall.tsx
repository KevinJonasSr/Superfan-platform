import Link from "next/link";

interface PremiumPaywallProps {
  /** What the user is trying to see. Used in the headline copy. */
  feature: string;
  /** Optional longer description of what they'll get. */
  description?: string;
  /** Community slug — paywall links go to /premium scoped to this community. */
  communityId?: string;
  /** Community accent colors. Falls back to the default aurora→ember gradient. */
  accentFrom?: string | null;
  accentTo?: string | null;
  /** Reason from canAccess() — drives the CTA text. */
  reason?: "signed-out" | "needs-premium";
  /** Compact variant for inline use (e.g. inside a post card). */
  compact?: boolean;
}

/**
 * The shared locked-state UI. Whenever a piece of content is gated behind
 * Premium, wrap it (or replace it) with this component so every paywall
 * across the app looks and behaves the same.
 *
 * The component is purely presentational — it assumes the caller already
 * decided the viewer can't see the content. Use canAccess() from
 * lib/entitlements.ts to make that call upstream.
 */
export default function PremiumPaywall({
  feature,
  description,
  communityId,
  accentFrom,
  accentTo,
  reason = "needs-premium",
  compact = false,
}: PremiumPaywallProps) {
  const from = accentFrom ?? "#7c3aed";
  const to = accentTo ?? "#fb923c";

  const ctaHref = reason === "signed-out"
    ? `/login?next=${encodeURIComponent(`/premium${communityId ? `?c=${communityId}` : ""}`)}`
    : "/premium";
  const ctaLabel = reason === "signed-out"
    ? "Sign in to unlock"
    : "Upgrade to Premium — $10/mo";

  if (compact) {
    return (
      <div
        className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm"
        style={{ borderColor: `${from}33` }}
      >
        <span
          className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-full text-base"
          style={{ backgroundImage: `linear-gradient(135deg, ${from}, ${to})` }}
        >
          🔒
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-white">
            {feature} is for Premium fans
          </p>
          {description && (
            <p className="truncate text-xs text-white/55">{description}</p>
          )}
        </div>
        <Link
          href={ctaHref}
          className="flex-none rounded-full px-3 py-1.5 text-xs font-semibold text-white shadow-glass transition hover:brightness-110"
          style={{ backgroundImage: `linear-gradient(90deg, ${from}, ${to})` }}
        >
          {reason === "signed-out" ? "Sign in" : "Upgrade"}
        </Link>
      </div>
    );
  }

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/40 p-6"
      style={{ borderColor: `${from}4D` }}
    >
      {/* Halo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage: `radial-gradient(ellipse at 0% 0%, ${from}40, transparent 60%)`,
        }}
      />

      <div className="relative">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-lg"
            style={{ backgroundImage: `linear-gradient(135deg, ${from}, ${to})` }}
          >
            🔒
          </span>
          <p className="text-xs uppercase tracking-widest text-white/55">
            Premium perk
          </p>
        </div>

        <h3
          className="mt-4 text-xl font-semibold text-white md:text-2xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {feature} is for Premium fans.
        </h3>
        {description && (
          <p className="mt-2 max-w-prose text-sm text-white/70">
            {description}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link
            href={ctaHref}
            className="inline-flex rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-glass transition hover:brightness-110"
            style={{ backgroundImage: `linear-gradient(90deg, ${from}, ${to})` }}
          >
            {ctaLabel}
          </Link>
          <Link
            href="/premium"
            className="text-xs text-white/55 underline-offset-4 hover:text-white/80 hover:underline"
          >
            What you get →
          </Link>
        </div>
      </div>
    </section>
  );
}
