import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Twilio inbound SMS webhook — carrier compliance for STOP / HELP keywords.
 *
 * Configure in Twilio Console:
 *   Messaging Service → Integration → Incoming Messages
 *   URL: https://<your-domain>/api/twilio/inbound (POST, x-www-form-urlencoded)
 *
 * We respond with TwiML so Twilio sends the correct reply back to the fan.
 * STOP / STOPALL / UNSUB / UNSUBSCRIBE / CANCEL / END / QUIT → opt out
 * HELP / INFO                                               → help text
 * START / YES / UNSTOP                                      → opt back in
 * Anything else                                             → silent ack (empty TwiML)
 */
const STOP_KEYWORDS = new Set([
  "STOP", "STOPALL", "UNSUB", "UNSUBSCRIBE", "CANCEL", "END", "QUIT",
]);
const HELP_KEYWORDS = new Set(["HELP", "INFO"]);
const START_KEYWORDS = new Set(["START", "YES", "UNSTOP"]);

function twimlResponse(message: string | null): NextResponse {
  const body = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response/>`;
  return new NextResponse(body, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

function escapeXml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

// Normalize a phone number to a loose compare string (strip everything but digits)
function normalizePhone(p: string | null | undefined): string {
  return (p ?? "").replace(/\D/g, "");
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const from = String(form.get("From") ?? "");
    const bodyRaw = String(form.get("Body") ?? "").trim();
    const keyword = bodyRaw.toUpperCase().split(/\s+/)[0] ?? "";

    if (!from) return twimlResponse(null);

    const admin = createAdminClient();

    if (STOP_KEYWORDS.has(keyword)) {
      // Match by normalized phone in case formatting drifts
      const digits = normalizePhone(from);
      const { data: fans } = await admin
        .from("fans")
        .select("id, phone, first_name");
      const target = (fans ?? []).find(
        (f) => normalizePhone(f.phone as string | null) === digits,
      );
      if (target) {
        await admin.from("fans").update({ sms_opted_in: false }).eq("id", target.id);
      }
      // Twilio also auto-handles STOP at the carrier level, but we reply explicitly
      // so both systems stay in sync.
      return twimlResponse(
        "You're unsubscribed from Fan Engage. Reply START to opt back in. Reply HELP for help.",
      );
    }

    if (START_KEYWORDS.has(keyword)) {
      const digits = normalizePhone(from);
      const { data: fans } = await admin
        .from("fans")
        .select("id, phone, first_name");
      const target = (fans ?? []).find(
        (f) => normalizePhone(f.phone as string | null) === digits,
      );
      if (target) {
        await admin.from("fans").update({ sms_opted_in: true }).eq("id", target.id);
      }
      return twimlResponse(
        "You're back in for Fan Engage updates. Reply STOP anytime to opt out.",
      );
    }

    if (HELP_KEYWORDS.has(keyword)) {
      return twimlResponse(
        "Fan Engage: artist alerts + fan rewards. Msg & data rates may apply. Reply STOP to opt out. Support: support@fanengage.app",
      );
    }

    // Anything else — silent 200
    return twimlResponse(null);
  } catch {
    // Never 500 on this endpoint — Twilio will retry and duplicate messages.
    return twimlResponse(null);
  }
}
