import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/refresh-monthly-credits
 *
 * Scheduled daily via vercel.json. Refreshes the $5 monthly credit on
 * premium/comped memberships whose credit is stale (>25 days since last
 * refresh). Two cases this catches:
 *
 *   1. COMPED members — they never hit invoice.paid, so the Stripe webhook
 *      never refreshes their credit. Without this cron, they'd perpetually
 *      stay at whatever credit balance they were comped with.
 *
 *   2. Premium members whose invoice.paid webhook failed — Stripe retries
 *      on 5xx but eventually gives up. This is the belt-and-suspenders
 *      safety net that catches anyone who slipped through.
 *
 * Matches the same 25-day threshold the webhook uses (see
 * handleInvoicePaid in /api/stripe/webhook/route.ts) so the two paths
 * are semantically identical — the webhook just catches most cases
 * sooner; this cron mops up the stragglers.
 *
 * Auth: Vercel Cron attaches Authorization: Bearer $CRON_SECRET. Reject
 * anything else so random callers can't drain credit grants.
 */
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = request.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const started = Date.now();
  const admin = createAdminClient();

  // Stale threshold — 25 days matches the invoice.paid handler so the two
  // refresh paths agree on when a credit is "due".
  const cutoffIso = new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString();

  // Candidates: paid tiers only. past_due (Stripe grace window) and
  // free/cancelled don't earn the credit.
  const { data: candidates, error: fetchErr } = await admin
    .from("fan_community_memberships")
    .select(
      "fan_id, community_id, subscription_tier, monthly_credit_refreshed_at",
    )
    .in("subscription_tier", ["premium", "comped"])
    .or(
      `monthly_credit_refreshed_at.is.null,monthly_credit_refreshed_at.lt.${cutoffIso}`,
    );

  if (fetchErr) {
    return NextResponse.json(
      { error: `candidate fetch failed: ${fetchErr.message}` },
      { status: 500 },
    );
  }

  const results: Array<{
    fan_id: string;
    community_id: string;
    tier: string;
    refreshed: boolean;
    error?: string;
  }> = [];

  for (const row of candidates ?? []) {
    const fanId = row.fan_id as string;
    const communityId = row.community_id as string;
    const tier = row.subscription_tier as string;
    const nowIso = new Date().toISOString();

    try {
      // Set credit + timestamp in one UPDATE — atomic with any concurrent
      // webhook by relying on last-write-wins (both paths idempotently
      // converge to monthly_credit_cents = 500, monthly_credit_refreshed_at
      // ≈ now, which is exactly what we want).
      const { error: updErr } = await admin
        .from("fan_community_memberships")
        .update({
          monthly_credit_cents: 500,
          monthly_credit_refreshed_at: nowIso,
        })
        .eq("fan_id", fanId)
        .eq("community_id", communityId);
      if (updErr) throw new Error(updErr.message);

      // Audit trail — stripe_event_id left null since there's no Stripe
      // event tied to a cron-driven refresh. reason='monthly_refresh'
      // matches what the webhook writes.
      const { error: grantErr } = await admin.from("credit_grants").insert({
        fan_id: fanId,
        community_id: communityId,
        amount_cents: 500,
        reason: "monthly_refresh",
      });
      if (grantErr) throw new Error(grantErr.message);

      results.push({
        fan_id: fanId,
        community_id: communityId,
        tier,
        refreshed: true,
      });
    } catch (e) {
      results.push({
        fan_id: fanId,
        community_id: communityId,
        tier,
        refreshed: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return NextResponse.json({
    elapsed_ms: Date.now() - started,
    candidates: candidates?.length ?? 0,
    refreshed: results.filter((r) => r.refreshed).length,
    failed: results.filter((r) => !r.refreshed).length,
    results,
  });
}
