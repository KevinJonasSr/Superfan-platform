import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type OnboardPayload = {
  firstName?: string;
  lastName?: string;
  city?: string;
  phone?: string;
  handle?: string;
  favoriteSong?: string;
  interest?: string;
  referralCode?: string; // optional — the ref code that was passed in the invite link
  smsOptedIn?: boolean;
  emailOptedIn?: boolean;
  consentAcceptedAt?: string;
  consentVersion?: string;
};

/**
 * Finalizes an onboarding submission for the currently-signed-in fan.
 * Idempotent: re-submitting updates the fan row and is a no-op for the
 * signup bonus if one has already been awarded.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const payload = (await request.json()) as OnboardPayload;

    // 1. Update the fan's profile row (created by the auth trigger).
    const { data: fan, error: updateErr } = await supabase
      .from("fans")
      .update({
        first_name: payload.firstName ?? null,
        last_name: payload.lastName ?? null,
        city: payload.city ?? null,
        phone: payload.phone ?? null,
        handle: payload.handle ?? null,
        favorite_song: payload.favoriteSong ?? null,
        interest: payload.interest ?? null,
        sms_opted_in: Boolean(payload.smsOptedIn),
        email_opted_in: Boolean(payload.emailOptedIn),
        consent_accepted_at: payload.consentAcceptedAt ?? new Date().toISOString(),
        consent_version: payload.consentVersion ?? null,
      })
      .eq("id", user.id)
      .select()
      .single();

    if (updateErr) {
      console.error("onboard: failed to update fan", updateErr);
      return NextResponse.json(
        { error: "Unable to save profile." },
        { status: 500 },
      );
    }

    // 2. Handle referral code — service-role so we can look up the referrer.
    if (payload.referralCode) {
      try {
        const admin = createAdminClient();
        const { data: referrer } = await admin
          .from("fans")
          .select("id")
          .eq("referral_code", payload.referralCode)
          .maybeSingle();

        if (referrer && referrer.id !== user.id) {
          await admin.from("referrals").upsert(
            {
              referrer_id: referrer.id,
              referred_id: user.id,
              referred_email: user.email ?? null,
              status: "verified",
              points_awarded: 150,
              verified_at: new Date().toISOString(),
            },
            { onConflict: "referred_id" },
          );
          await admin.from("points_ledger").insert({
            fan_id: referrer.id,
            delta: 150,
            source: "referral",
            source_ref: user.id,
            note: `Referred by ${user.email}`,
          });
          await admin
            .from("fans")
            .update({
              total_points: ((await getTotal(admin, referrer.id)) ?? 0) + 150,
            })
            .eq("id", referrer.id);
          await admin
            .from("fans")
            .update({ referred_by: referrer.id })
            .eq("id", user.id);
        }
      } catch (err) {
        console.warn("onboard: referral handling failed", err);
        // don't block the onboarding response on referral failure
      }
    }

    // 3. Award signup bonus — idempotent via source_ref = `signup:${userId}`.
    try {
      const admin = createAdminClient();
      const sourceRef = `signup:${user.id}`;
      const { data: existing } = await admin
        .from("points_ledger")
        .select("id")
        .eq("source", "signup_bonus")
        .eq("source_ref", sourceRef)
        .maybeSingle();

      if (!existing) {
        await admin.from("points_ledger").insert({
          fan_id: user.id,
          delta: 100,
          source: "signup_bonus",
          source_ref: sourceRef,
          note: "Welcome to Fan Engage",
        });
        const newTotal = ((await getTotal(admin, user.id)) ?? 0) + 100;
        await admin
          .from("fans")
          .update({ total_points: newTotal })
          .eq("id", user.id);
      }
    } catch (err) {
      console.warn("onboard: signup bonus failed", err);
      // non-fatal — profile save still succeeded
    }

    return NextResponse.json({ success: true, fan });
  } catch (err) {
    console.error("onboard route error:", err);
    return NextResponse.json(
      { error: "Unable to complete onboarding." },
      { status: 500 },
    );
  }
}

async function getTotal(
  admin: ReturnType<typeof createAdminClient>,
  fanId: string,
): Promise<number | null> {
  const { data } = await admin
    .from("fans")
    .select("total_points")
    .eq("id", fanId)
    .maybeSingle();
  return (data?.total_points as number | null) ?? 0;
}
