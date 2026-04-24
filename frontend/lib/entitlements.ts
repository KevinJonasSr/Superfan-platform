import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Subscription tier states we recognize. Mirrors the enum space of
 * fan_community_memberships.subscription_tier.
 */
export type SubscriptionTier =
  | "free"
  | "premium"
  | "comped"
  | "past_due"
  | "cancelled";

export interface MembershipEntitlement {
  fanId: string;
  communityId: string;
  tier: SubscriptionTier;
  isPremium: boolean;
  isFounder: boolean;
  founderNumber: number | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  monthlyCreditCents: number;
  billingPeriod: "monthly" | "annual" | null;
}

/**
 * Returns true if the tier grants Premium-level access. 'past_due' counts
 * because Stripe is still retrying — we keep access until Stripe gives up
 * and fires subscription.deleted, which flips the row to 'cancelled'.
 */
export function isPremiumTier(
  tier: SubscriptionTier | string | null | undefined,
): boolean {
  return tier === "premium" || tier === "comped" || tier === "past_due";
}

/**
 * Fetch the current viewer's entitlement for a specific community. Returns
 * null if signed out, or if no membership row exists. Uses the admin
 * client so RLS doesn't interfere — entitlement checks MUST be exhaustive
 * across all fans/communities regardless of RLS scoping.
 */
export async function getEntitlement(
  fanId: string,
  communityId: string,
): Promise<MembershipEntitlement | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("fan_community_memberships")
    .select(
      "fan_id, community_id, subscription_tier, is_founder, founder_number, current_period_end, cancel_at_period_end, monthly_credit_cents, billing_period",
    )
    .eq("fan_id", fanId)
    .eq("community_id", communityId)
    .maybeSingle();

  if (!data) return null;

  const tier = (data.subscription_tier as SubscriptionTier | null) ?? "free";
  return {
    fanId: data.fan_id as string,
    communityId: data.community_id as string,
    tier,
    isPremium: isPremiumTier(tier),
    isFounder: Boolean(data.is_founder),
    founderNumber: (data.founder_number as number | null) ?? null,
    currentPeriodEnd: (data.current_period_end as string | null) ?? null,
    cancelAtPeriodEnd: Boolean(data.cancel_at_period_end),
    monthlyCreditCents: (data.monthly_credit_cents as number | null) ?? 0,
    billingPeriod:
      (data.billing_period as "monthly" | "annual" | null) ?? null,
  };
}

/**
 * Shortcut for the most common call pattern — read the current signed-in
 * viewer's entitlement for the currently-scoped community. Returns null if
 * signed out. Safe to call in any server component.
 */
export async function getViewerEntitlement(
  communityId: string,
): Promise<MembershipEntitlement | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    return await getEntitlement(user.id, communityId);
  } catch {
    return null;
  }
}

/**
 * Decide whether a viewer can see a specific piece of content. Abstracts
 * the matrix of (viewer tier × content tag) so callers don't have to
 * re-derive it. Returns { allowed, reason } where reason is a short string
 * useful for analytics / paywall UX copy.
 *
 * Matrix:
 * - 'public': always allowed
 * - 'premium': allowed if viewer is premium/comped/past_due; else 'needs-premium'
 *             or 'signed-out' if not authenticated
 * - 'founder-only': allowed only if viewer has is_founder=true; else
 *                   'needs-founder' if authenticated but not a founder, or
 *                   'signed-out' if not authenticated
 */
export function canAccess(
  contentTier: "public" | "premium" | "founder-only",
  viewer: MembershipEntitlement | null,
): {
  allowed: boolean;
  reason: "public" | "premium-member" | "founder-member" | "needs-premium" | "needs-founder" | "signed-out";
} {
  if (contentTier === "public") {
    return { allowed: true, reason: "public" };
  }

  if (!viewer) {
    return { allowed: false, reason: "signed-out" };
  }

  if (contentTier === "founder-only") {
    if (viewer.isFounder) {
      return { allowed: true, reason: "founder-member" };
    }
    return { allowed: false, reason: "needs-founder" };
  }

  // contentTier === "premium"
  if (viewer.isPremium) {
    return { allowed: true, reason: "premium-member" };
  }
  return { allowed: false, reason: "needs-premium" };
}
