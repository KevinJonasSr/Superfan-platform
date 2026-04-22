import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Campaign broadcast helpers — send a single email or SMS blast to every fan
 * of an artist (or every fan globally) who has opted in via the matching
 * channel. Safe to call from server actions and API routes.
 */

export type BroadcastResult = {
  attempted: number;
  sent: number;
  failed: number;
  recipients: number; // how many fans matched before any send
  error?: string;
};

async function loadRecipients(opts: {
  artistSlug?: string | null;
  channel: "email" | "sms";
}) {
  const admin = createAdminClient();
  const optColumn = opts.channel === "email" ? "email_opted_in" : "sms_opted_in";
  const contactColumn = opts.channel === "email" ? "email" : "phone";

  // Artist-scoped audience is a placeholder: we don't have a
  // fan_artist_following join yet, so "artist-scoped" currently means
  // "every opted-in fan of the platform". When the follow table lands we
  // filter by it here.
  void opts.artistSlug;

  const { data, error } = await admin
    .from("fans")
    .select("id, first_name, email, phone, sms_opted_in, email_opted_in, suspended")
    .eq(optColumn, true)
    .eq("suspended", false)
    .not(contactColumn, "is", null);

  if (error) throw error;
  return (data ?? []) as Array<{
    id: string;
    first_name: string | null;
    email: string | null;
    phone: string | null;
  }>;
}

/** Send an SMS to every opted-in fan via Twilio. */
export async function broadcastSms(params: {
  body: string;
  artistSlug?: string | null;
}): Promise<BroadcastResult> {
  const result: BroadcastResult = { attempted: 0, sent: 0, failed: 0, recipients: 0 };

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const defaultFrom = process.env.TWILIO_DEFAULT_FROM;
  if (!accountSid || !authToken || (!messagingServiceSid && !defaultFrom)) {
    return { ...result, error: "Twilio not configured" };
  }

  const recipients = await loadRecipients({ artistSlug: params.artistSlug, channel: "sms" });
  result.recipients = recipients.length;
  if (recipients.length === 0) return result;

  const { default: twilio } = await import("twilio");
  const client = twilio(accountSid, authToken);

  for (const fan of recipients) {
    if (!fan.phone) continue;
    result.attempted += 1;
    try {
      await client.messages.create({
        to: fan.phone,
        body: params.body,
        ...(messagingServiceSid
          ? { messagingServiceSid }
          : { from: defaultFrom as string }),
      });
      result.sent += 1;
    } catch (err) {
      console.error("broadcastSms: send failed for", fan.id, err);
      result.failed += 1;
    }
    // Throttle to stay under Twilio trial rate limits (1 msg/sec).
    await new Promise((r) => setTimeout(r, 250));
  }

  return result;
}

/**
 * Send an email blast via Mailchimp Campaigns API — creates a one-off
 * regular campaign against the configured audience, sets plain-text + html
 * content, and fires it immediately.
 *
 * Note: this sends to every audience member (not just fans who logged in
 * via the app), since Mailchimp segments are owned on their side. For
 * app-only targeting we'd need a Mailchimp interest/group or tag-based
 * segment — wire-up deferred to a future phase.
 */
export async function broadcastEmail(params: {
  subject: string;
  body: string;
  fromName?: string;
  replyTo?: string;
}): Promise<BroadcastResult> {
  const result: BroadcastResult = { attempted: 0, sent: 0, failed: 0, recipients: 0 };

  const apiKey = process.env.MAILCHIMP_API_KEY;
  const server = process.env.MAILCHIMP_SERVER_PREFIX;
  const listId = process.env.MAILCHIMP_AUDIENCE_ID;
  if (!apiKey || !server || !listId) {
    return { ...result, error: "Mailchimp not configured" };
  }

  const authHeader = `Basic ${Buffer.from(`anystring:${apiKey}`).toString("base64")}`;
  const base = `https://${server}.api.mailchimp.com/3.0`;

  try {
    // 1) Create campaign
    const createRes = await fetch(`${base}/campaigns`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader },
      body: JSON.stringify({
        type: "regular",
        recipients: { list_id: listId },
        settings: {
          subject_line: params.subject,
          title: `Fan Engage — ${params.subject}`.slice(0, 100),
          from_name: params.fromName ?? "Fan Engage",
          reply_to: params.replyTo ?? "no-reply@fanengage.app",
          preview_text: params.subject,
        },
      }),
    });
    if (!createRes.ok) {
      const detail = await createRes.json().catch(() => ({}));
      return { ...result, error: `Mailchimp create failed: ${createRes.status} ${JSON.stringify(detail).slice(0, 200)}` };
    }
    const { id: campaignId, emails_sent, recipients } = await createRes.json();
    const memberCount =
      (recipients?.segment_opts?.saved_segment_id ? 0 : recipients?.recipient_count) ??
      0;
    result.recipients = memberCount;
    result.attempted = emails_sent ?? memberCount;

    // 2) Set content (plain text + simple HTML wrapper)
    const contentRes = await fetch(`${base}/campaigns/${campaignId}/content`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: authHeader },
      body: JSON.stringify({
        plain_text: params.body,
        html: `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;line-height:1.5;color:#0f172a">
<h2 style="margin:0 0 16px;font-size:22px">${escapeHtml(params.subject)}</h2>
<div style="white-space:pre-wrap">${escapeHtml(params.body)}</div>
<p style="margin-top:32px;font-size:12px;color:#64748b">Sent via Fan Engage · <a href="*|UNSUB|*" style="color:#64748b">Unsubscribe</a></p>
</body></html>`,
      }),
    });
    if (!contentRes.ok) {
      const detail = await contentRes.json().catch(() => ({}));
      return { ...result, error: `Mailchimp content failed: ${contentRes.status} ${JSON.stringify(detail).slice(0, 200)}` };
    }

    // 3) Send immediately
    const sendRes = await fetch(`${base}/campaigns/${campaignId}/actions/send`, {
      method: "POST",
      headers: { Authorization: authHeader },
    });
    if (!sendRes.ok) {
      const detail = await sendRes.json().catch(() => ({}));
      return { ...result, error: `Mailchimp send failed: ${sendRes.status} ${JSON.stringify(detail).slice(0, 200)}` };
    }
    result.sent = result.attempted;
    return result;
  } catch (err) {
    console.error("broadcastEmail error:", err);
    return { ...result, error: err instanceof Error ? err.message : String(err) };
  }
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
