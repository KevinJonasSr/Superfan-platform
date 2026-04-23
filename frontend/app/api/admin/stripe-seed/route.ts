import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import type { Community } from "@/lib/community";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/stripe-seed?community_id=<slug>
 *
 * One-shot seeder: creates a Stripe Product + 4 Prices for a community
 * and writes the IDs back to the communities row. Protected by a
 * Bearer token matching STRIPE_SEED_SECRET. Same effect as clicking
 * "Seed Stripe" on /admin/stripe/seed, but reachable without the
 * Basic+Supabase auth chain — intended for one-time bootstrap + future
 * automated seeding when new communities launch.
 *
 * Idempotent: if the community already has stripe_product_id set,
 * returns the existing IDs without creating duplicates.
 */
export async function POST(request: Request) {
  const expected = process.env.STRIPE_SEED_SECRET;
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "STRIPE_SEED_SECRET not configured" },
      { status: 500 },
    );
  }

  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const communityId = (searchParams.get("community_id") ?? "").trim();
  if (!communityId) {
    return NextResponse.json(
      { ok: false, error: "Missing community_id query param" },
      { status: 400 },
    );
  }

  const db = createAdminClient();
  const { data: row, error: loadErr } = await db
    .from("communities")
    .select("*")
    .eq("slug", communityId)
    .maybeSingle();
  if (loadErr || !row) {
    return NextResponse.json(
      { ok: false, error: loadErr?.message ?? "Community not found" },
      { status: 404 },
    );
  }
  const community = row as Community & {
    monthly_price_cents: number;
    annual_price_cents: number;
    stripe_product_id: string | null;
    stripe_price_id_monthly: string | null;
    stripe_price_id_annual: string | null;
    stripe_price_id_founder_monthly: string | null;
    stripe_price_id_founder_annual: string | null;
  };

  if (community.stripe_product_id && community.stripe_price_id_monthly) {
    return NextResponse.json({
      ok: true,
      already_seeded: true,
      community_id: community.slug,
      product_id: community.stripe_product_id,
      price_ids: {
        standard_monthly: community.stripe_price_id_monthly,
        standard_annual: community.stripe_price_id_annual,
        founder_monthly: community.stripe_price_id_founder_monthly,
        founder_annual: community.stripe_price_id_founder_annual,
      },
    });
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Stripe not configured",
      },
      { status: 500 },
    );
  }

  try {
    const product = await stripe.products.create({
      name: `${community.display_name} — Premium Fan Club`,
      description:
        community.tagline ??
        `Premium membership for ${community.display_name}.`,
      metadata: {
        community_slug: community.slug,
        community_type: community.type,
      },
    });

    const mkPrice = (
      amount: number,
      interval: "month" | "year",
      tier: "standard" | "founder",
    ) =>
      stripe.prices.create({
        product: product.id,
        currency: "usd",
        unit_amount: amount,
        recurring: { interval },
        lookup_key: `${community.slug}_${tier}_${interval === "month" ? "monthly" : "annual"}`,
        metadata: {
          community_slug: community.slug,
          tier,
          billing_period: interval === "month" ? "monthly" : "annual",
        },
      });

    const [monthly, annual, founderMonthly, founderAnnual] = await Promise.all([
      mkPrice(community.monthly_price_cents, "month", "standard"),
      mkPrice(community.annual_price_cents, "year", "standard"),
      mkPrice(community.monthly_price_cents, "month", "founder"),
      mkPrice(community.annual_price_cents, "year", "founder"),
    ]);

    const { error: updErr } = await db
      .from("communities")
      .update({
        stripe_product_id: product.id,
        stripe_price_id_monthly: monthly.id,
        stripe_price_id_annual: annual.id,
        stripe_price_id_founder_monthly: founderMonthly.id,
        stripe_price_id_founder_annual: founderAnnual.id,
      })
      .eq("slug", community.slug);
    if (updErr) {
      return NextResponse.json(
        { ok: false, error: updErr.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      already_seeded: false,
      community_id: community.slug,
      product_id: product.id,
      price_ids: {
        standard_monthly: monthly.id,
        standard_annual: annual.id,
        founder_monthly: founderMonthly.id,
        founder_annual: founderAnnual.id,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("stripe-seed: error", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
