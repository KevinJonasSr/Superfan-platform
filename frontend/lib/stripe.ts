import Stripe from "stripe";

/**
 * Server-only Stripe client. Uses STRIPE_SECRET_KEY from env — test-mode
 * key today, live-mode at launch. Pinned to a specific API version so
 * SDK upgrades don't silently change behavior.
 *
 * NEVER import this from a client component. It's guarded by a runtime
 * throw if the key is missing rather than erroring at import time, so
 * the admin page can render a "key not set" message instead of crashing
 * the whole build.
 */
let _client: Stripe | null = null;

export function getStripe(): Stripe {
  if (_client) return _client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set — configure it in Vercel env vars (Production + Preview).",
    );
  }
  _client = new Stripe(key, {
    // Omit apiVersion — SDK uses its compiled default, which is what our
    // type definitions expect. When we bump the SDK we'll re-pin here.
    typescript: true,
    appInfo: {
      name: "Fan Engage",
      url: "https://fan-engage-pearl.vercel.app",
    },
  });
  return _client;
}

/** Convenience — return null if the key isn't set, rather than throwing.
 *  Useful for admin pages that want to render a "not configured" state. */
export function getStripeOrNull(): Stripe | null {
  try {
    return getStripe();
  } catch {
    return null;
  }
}
