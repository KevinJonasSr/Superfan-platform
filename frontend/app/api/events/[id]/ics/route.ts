import { NextResponse } from "next/server";
import { buildIcs, getEventById } from "@/lib/data/events";

export const runtime = "nodejs";

/**
 * GET /api/events/:id/ics — download iCalendar file for an event.
 * Works for anyone (no auth), since event info is public.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const event = await getEventById(id);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const ics = buildIcs(event);
  const filename = `${event.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40)}.ics`;
  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "public, max-age=60",
    },
  });
}
