import { NextResponse } from "next/server";
import twilio from "twilio";

export const runtime = "nodejs";

type SmsPayload = {
  phone: string;
  firstName?: string;
  interest?: string;
};

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
const defaultFrom = process.env.TWILIO_DEFAULT_FROM;

export async function POST(request: Request) {
  if (!accountSid || !authToken || (!messagingServiceSid && !defaultFrom)) {
    return NextResponse.json(
      { error: "Twilio credentials are not configured" },
      { status: 500 }
    );
  }

  try {
    const { phone, firstName, interest } = (await request.json()) as SmsPayload;

    if (!phone) {
      return NextResponse.json({ error: "Phone number required" }, { status: 400 });
    }

    const client = twilio(accountSid, authToken);
    // Welcome text — points at the first point-earning action so the fan has
    // a reason to open the app right away. Includes carrier-required opt-out.
    const body =
      `Hey ${firstName ?? "fan"}! 🎶 Welcome to Fan Engage` +
      (interest ? ` — we'll keep an ear out for ${interest}.` : ".") +
      ` Earn your first 100 pts: follow an artist, RSVP to an event, or share the app. ` +
      `Reply HELP for help. STOP to opt out. Msg&data rates may apply.`;

    const config: Parameters<typeof client.messages.create>[0] = {
      to: phone,
      body,
    };

    if (messagingServiceSid) {
      config.messagingServiceSid = messagingServiceSid;
    } else if (defaultFrom) {
      config.from = defaultFrom;
    }

    await client.messages.create(config);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to send Twilio opt-in:", error);
    return NextResponse.json(
      { error: "Unable to send confirmation text." },
      { status: 500 }
    );
  }
}
