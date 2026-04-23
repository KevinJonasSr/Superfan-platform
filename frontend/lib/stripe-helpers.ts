import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

/**
 * Server-only helpers for the Stripe Checkout + subscription flow.
 */

/**
 * Get-or-create the Stripe Customer for a fan. Caches the customer id on
 * `fans.stripe_customer_id`. One customer per fan, shared across every
 * community they subscribe to — matches Stripe's best practice for
 * multi-product, single-customer setups.
 */
export async function getOrCreateStripeCustomer(params: {
  fanId: string;
  email: string;
  firstName?: string | null;
}): Promise<string> {
  const admin = createAdminClient();
  const { data: fan } = await admin
    .from("fans")
    .select("stripe_customer_id")
    .eq("id", params.fanId)
    .maybeSingle();

  const existing = fan?.stripe_customer_id as string | null;
  if (existing) return existing;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: params.email,
    name: params.firstName ?? undefined,
    metadata: { fan_id: params.fanId },
  });

  await admin
    .from("fans")
    .update({ stripe_customer_id: customer.id })
    .eq("id", params.fanId);

  return customer.id;
}

export interface FounderState {
  founderCap: number;
  founderCount: number;
  slotsRemaining: number;
  isFull: boolean;
}

/**
 * Count memberships that have ever been premium (active + past_due +
 * cancelled — i.e. anyone who has at some point paid). Founders = first N
 * by time. Once 100 people have subscribed, the cap is hit; subsequent
 * subscribers get standard pricing even if they sign up via /premium with
 * a founder query param.
 */
export async function getFounderState(communityId: string): Promise<FounderState> {
  const admin = createAdminClient();
  const [{ data: community }, { count }] = await Promise.all([
    admin
      .from("communities")
      .select("founder_cap")
      .eq("slug", communityId)
      .maybeSingle(),
    admin
      .from("fan_community_memberships")
      .select("fan_id", { count: "exact", head: true })
      .eq("community_id", communityId)
      .in("subscription_tier", ["premium", "past_due", "cancelled"]),
  ]);

  const founderCap = (community?.founder_cap as number) ?? 100;
  const founderCount = count ?? 0;
  const slotsRemaining = Math.max(0, founderCap - founderCount);
  return {
    founderCap,
    founderCount,
    slotsRemaining,
    isFull: slotsRemaining === 0,
  };
}

/**
 * Pick the right Stripe price_id for a given billing period + founder
 * eligibility. Returns null if the community isn't seeded yet.
 */
export function pickPriceId(
  community: {
    stripe_price_id_monthly: string | null;
    stripe_price_id_annual: string | null;
    stripe_price_id_founder_monthly: string | null;
    stripe_price_id_founder_annual: string | null;
  },
  billingPeriod: "monthly" | "annual",
  asFounder: boolean,
): string | null {
  if (asFounder) {
    return billingPeriod === "monthly"
      ? community.stripe_price_id_founder_monthly
      : community.stripe_price_id_founder_annual;
  }
  return billingPeriod === "monthly"
    ? community.stripe_price_id_monthly
    : community.stripe_price_id_annual;
}

/** `1000` cents → `"$10"`. */
export function fmtPrice(cents: number): string {
  const dollars = cents / 100;
  return dollars % 1 === 0 ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}
