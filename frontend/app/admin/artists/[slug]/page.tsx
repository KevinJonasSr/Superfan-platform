import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { listEventsForAdmin } from "@/lib/data/artists";
import { listRsvpsForEvent } from "@/lib/data/events";
import ArtistEditForm from "./edit-form";
import { createEventAction, deleteEventAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminArtistEditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const admin = createAdminClient();
  const { data: artist } = await admin
    .from("artists")
    .select("slug, name, tagline, bio, hero_image, accent_from, accent_to, genres, social, active, sort_order")
    .eq("slug", slug)
    .maybeSingle();
  if (!artist) notFound();

  const events = await listEventsForAdmin(slug);
  const rsvpListsByEvent = await Promise.all(
    events.map((e) => listRsvpsForEvent(e.id)),
  );

  const social = (artist.social ?? []) as Array<{ label: string; href: string }>;
  const socialText = social.map((s) => `${s.label}|${s.href}`).join("\n");
  const genresText = (artist.genres ?? []).join(", ");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/artists" className="text-xs text-white/60 hover:text-white">
            ← Back to artists
          </Link>
          <h1 className="mt-2 text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
            Edit {artist.name as string}
          </h1>
          <p className="mt-1 text-xs text-white/60">/{artist.slug as string}</p>
        </div>
        <Link
          href={`/artists/${artist.slug as string}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-white/20 px-4 py-2 text-xs text-white/80 hover:bg-white/10"
        >
          View public page ↗
        </Link>
      </div>

      <ArtistEditForm
        slug={artist.slug as string}
        initial={{
          name: (artist.name as string) ?? "",
          tagline: (artist.tagline as string | null) ?? "",
          bio: (artist.bio as string | null) ?? "",
          heroImage: (artist.hero_image as string | null) ?? null,
          accentFrom: (artist.accent_from as string) ?? "#7c3aed",
          accentTo: (artist.accent_to as string) ?? "#f97316",
          genresText,
          socialText,
          active: (artist.active as boolean) ?? true,
          sortOrder: (artist.sort_order as number) ?? 99,
        }}
      />

      {/* Events CRUD */}
      <section className="glass-card p-5">
        <p className="text-sm font-semibold">Upcoming events</p>
        <p className="mt-1 text-xs text-white/60">
          Shown on the artist page. Set <span className="text-white/80">active = false</span> to hide without deleting.
        </p>
        <div className="mt-3 space-y-3">
          {events.length === 0 && <p className="text-xs text-white/50">No events yet.</p>}
          {events.map((e, i) => {
            const rsvps = rsvpListsByEvent[i] ?? [];
            const atCap =
              e.capacity != null && e.capacity > 0 && rsvps.length >= e.capacity;
            return (
              <div key={e.id} className="rounded-2xl bg-black/40 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      {e.title}
                      {!e.active && (
                        <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase text-white/50">
                          Inactive
                        </span>
                      )}
                      {atCap && (
                        <span className="ml-2 rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] uppercase text-rose-200">
                          Full
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-white/60">
                      {e.detail ?? "—"} · {e.event_date ?? "—"}
                      {e.location ? ` · 📍 ${e.location}` : ""}
                    </p>
                    <p className="mt-1 text-[11px] text-white/50">
                      {rsvps.length}
                      {e.capacity ? ` / ${e.capacity}` : ""} RSVPed
                    </p>
                    {e.url && <p className="mt-1 text-[10px] text-white/50 truncate">{e.url}</p>}
                  </div>
                  <form action={deleteEventAction}>
                    <input type="hidden" name="event_id" value={e.id} />
                    <input type="hidden" name="artist_slug" value={slug} />
                    <button className="text-xs text-rose-300/80 hover:text-rose-300">
                      Delete
                    </button>
                  </form>
                </div>
                {rsvps.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[11px] text-white/60 hover:text-white">
                      View RSVPs ({rsvps.length})
                    </summary>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {rsvps.map((r) => (
                        <Link
                          key={r.fan_id}
                          href={`/admin/fans/${r.fan_id}`}
                          className="inline-flex items-center gap-2 rounded-full bg-white/5 px-2 py-1 text-[11px] hover:bg-white/10"
                        >
                          {r.fan?.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={r.fan.avatar_url as string}
                              alt=""
                              className="h-4 w-4 rounded-full object-cover"
                            />
                          ) : (
                            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-aurora to-ember text-[8px] font-bold">
                              {(r.fan?.first_name?.[0] ?? "F").toUpperCase()}
                            </span>
                          )}
                          <span>{r.fan?.first_name ?? "Anonymous"}</span>
                        </Link>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            );
          })}
        </div>

        <form action={createEventAction} className="mt-4 grid gap-2 md:grid-cols-2">
          <input type="hidden" name="artist_slug" value={slug} />
          <input
            name="title"
            required
            placeholder="Event title"
            className="rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
          />
          <input
            name="starts_at"
            type="datetime-local"
            placeholder="Start date/time"
            className="rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
          />
          <input
            name="event_date"
            placeholder="Display date (Mar 14 · 7 PM)"
            className="rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
          />
          <input
            name="location"
            placeholder="Location (Nashville, TN)"
            className="rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
          />
          <input
            name="detail"
            placeholder="Detail (Fan Engage members only)"
            className="rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
          />
          <input
            name="url"
            placeholder="URL (ticket link / livestream)"
            className="rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
          />
          <input
            name="capacity"
            type="number"
            placeholder="Capacity (blank = unlimited)"
            className="rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
          />
          <input
            name="sort_order"
            type="number"
            defaultValue="0"
            placeholder="Sort order"
            className="rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-full bg-gradient-to-r from-aurora to-ember px-4 py-2 text-sm font-semibold text-white md:col-span-2"
          >
            + Add event
          </button>
        </form>
      </section>
    </div>
  );
}
