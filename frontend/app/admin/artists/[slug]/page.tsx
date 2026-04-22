import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { listEventsForAdmin } from "@/lib/data/artists";
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
        <div className="mt-3 space-y-2">
          {events.length === 0 && <p className="text-xs text-white/50">No events yet.</p>}
          {events.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-black/40 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {e.title}
                  {!e.active && <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase text-white/50">Inactive</span>}
                </p>
                <p className="text-xs text-white/60">
                  {e.detail ?? "—"} · {e.event_date ?? "—"}
                </p>
                {e.url && <p className="mt-1 text-[10px] text-white/50 truncate">{e.url}</p>}
              </div>
              <form action={deleteEventAction}>
                <input type="hidden" name="event_id" value={e.id} />
                <input type="hidden" name="artist_slug" value={slug} />
                <button className="text-xs text-rose-300/80 hover:text-rose-300">Delete</button>
              </form>
            </div>
          ))}
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
            name="event_date"
            placeholder="Date (free form, e.g. Mar 14, 2026)"
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
