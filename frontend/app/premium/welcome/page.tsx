import Link from "next/link";
import { redirect } from "next/navigation";
import { getStripe } from "@/lib/stripe";
import { getCurrentCommunity } from "@/lib/community";

export const dynamic = "force-dynamic";

/**
 * Post-checkout landing. Stripe redirects the browser here with
 * `?session_id=cs_...`. We fetch the Session server-side to confirm
 * payment before displaying the welcome UI — the webhook has likely
 * already fired and flipped the membership to 'premium', but the
 * webhook is async so we don't guarantee DB state is updated yet.
 * This page shows the payment confirmation; the membership will be
 * live by the next page render.
 */
export default async function PremiumWelcomePage({
  searchParams,
}: {
  searchParams?: Promise<{ session_id?: string }>;
}) {
  const params = (await searchParams) ?? {};
  if (!params.session_id) redirect("/premium");

  const community = await getCurrentCommunity();

  let status: "complete" | "pending" | "unknown" = "unknown";
  let customerEmail: string | null = null;
  let billingPeriod: string | null = null;
  let isFounder = false;

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(
      params.session_id,
      { expand: ["subscription", "line_items.data.price"] },
    );

    if (session.payment_status === "paid" || session.status === "complete") {
      status = "complete";
    } else {
      status = "pending";
    }

    customerEmail = session.customer_details?.email ?? null;
    const meta = session.metadata ?? {};
    billingPeriod = (meta.billing_period as string | undefined) ?? null;
    isFounder = meta.tier === "founder";
  } catch (err) {
    console.warn("PremiumWelcomePage: failed to fetch session", err);
  }

  const accentFrom = community?.accent_from ?? "#7c3aed";
  const accentTo = community?.accent_to ?? "#fb923c";

  return (
    <main className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[500px] opacity-40"
        style={{
          backgroundImage: `radial-gradient(ellipse at 50% 0%, ${accentFrom}55, transparent 60%)`,
        }}
      />

      <div className="relative mx-auto max-w-2xl px-6 py-24 text-center">
        <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full text-3xl"
             style={{ backgroundImage: `linear-gradient(135deg, ${accentFrom}, ${accentTo})` }}>
          {status === "complete" ? "✓" : "⏳"}
        </div>

        {status === "complete" ? (
          <>
            <h1
              className="text-4xl font-semibold md:text-5xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Welcome to{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage: `linear-gradient(90deg, ${accentFrom}, ${accentTo})`,
                }}
              >
                {community?.display_name ?? "the community"} Premium
              </span>
              .
            </h1>
            <p className="mt-4 text-white/70">
              {isFounder
                ? "You're a Founding Fan — thanks for being one of the first 100. Your price is locked in forever."
                : billingPeriod === "annual"
                  ? "Your annual membership is active."
                  : "Your monthly membership is active."}{" "}
              {customerEmail && (
                <>A receipt is on its way to <span className="text-white">{customerEmail}</span>.</>
              )}
            </p>
          </>
        ) : (
          <>
            <h1
              className="text-4xl font-semibold md:text-5xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Processing…
            </h1>
            <p className="mt-4 text-white/70">
              Stripe is confirming your payment. Refresh in a moment or head
              back to the community — your Premium perks will be live
              within seconds.
            </p>
          </>
        )}

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="rounded-full px-6 py-3 text-sm font-semibold text-white shadow-glass transition hover:brightness-110"
            style={{
              backgroundImage: `linear-gradient(90deg, ${accentFrom}, ${accentTo})`,
            }}
          >
            Go to community →
          </Link>
          <Link
            href="/inbox"
            className="rounded-full border border-white/25 px-5 py-3 text-sm font-medium text-white/80 hover:bg-white/10"
          >
            Open inbox
          </Link>
        </div>

        {isFounder && status === "complete" && (
          <p className="mt-12 text-xs uppercase tracking-widest text-white/45">
            🌟 Founding Fan — locked-in pricing for life
          </p>
        )}
      </div>
    </main>
  );
}
