import { NextResponse } from "next/server";

export const runtime = "nodejs";

type SubscribePayload = {
  email: string;
  firstName?: string;
  lastName?: string;
  tags?: string[];
};

/**
 * Subscribes a fan to the configured Mailchimp audience.
 *
 * Uses PUT /lists/{id}/members/{subscriber_hash} which is an upsert —
 * calling it twice with the same email is safe.
 */
export async function POST(request: Request) {
  const apiKey = process.env.MAILCHIMP_API_KEY;
  const server = process.env.MAILCHIMP_SERVER_PREFIX;
  const listId = process.env.MAILCHIMP_AUDIENCE_ID;

  if (!apiKey || !server || !listId) {
    return NextResponse.json(
      {
        error:
          "Mailchimp is not configured yet. Set MAILCHIMP_API_KEY, MAILCHIMP_SERVER_PREFIX, and MAILCHIMP_AUDIENCE_ID.",
      },
      { status: 503 },
    );
  }

  try {
    const { email, firstName, lastName, tags } =
      (await request.json()) as SubscribePayload;

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const subscriberHash = await md5Lowercase(email);
    const url = `https://${server}.api.mailchimp.com/3.0/lists/${listId}/members/${subscriberHash}`;

    const body: Record<string, unknown> = {
      email_address: email,
      status_if_new: "subscribed",
      merge_fields: {
        ...(firstName ? { FNAME: firstName } : {}),
        ...(lastName ? { LNAME: lastName } : {}),
      },
    };
    if (tags && tags.length > 0) body.tags = tags;

    const authHeader = `Basic ${Buffer.from(`anystring:${apiKey}`).toString("base64")}`;

    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      console.error("Mailchimp subscribe failed:", res.status, detail);
      return NextResponse.json(
        { error: "Unable to subscribe to audience.", detail },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Mailchimp route error:", error);
    return NextResponse.json(
      { error: "Unable to subscribe to audience." },
      { status: 500 },
    );
  }
}

/** Mailchimp subscriber hash = lowercased-email md5. Uses built-in WebCrypto. */
async function md5Lowercase(email: string): Promise<string> {
  // Node crypto — works in Next.js nodejs runtime.
  const { createHash } = await import("node:crypto");
  return createHash("md5").update(email.trim().toLowerCase()).digest("hex");
}
