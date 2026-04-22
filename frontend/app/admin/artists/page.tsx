import Link from "next/link";
import { listArtistsForAdmin } from "@/lib/data/artists";
import { createArtistAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminArtistsPage() {
  const artists = await listArtistsForAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          Artists
        </h1>
        <p className="mt-1 text-sm text-white/60">
          Manage artist pages, hero images, bios, events, and social links — no code deploys required.
        </p>
      </div>

      <section className="space-y-3">
        {artists.length === 0 ? (
          <p className="text-xs text-white/50">No artists yet.</p>
        ) : (
          artists.map((a) => (
            <Link
              key={a.slug}
              href={`/admin/artists/${a.slug}`}
              className="block rounded-2xl border border-white/10 bg-black/30 p-4 transition hover:border-white/30"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {a.hero_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.hero_image}
                      alt=""
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <span
                      className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-white"
                      style={{ backgroundImage: `linear-gradient(to bottom right, ${a.accent_from}, ${a.accent_to})` }}
                    >
                      {a.name.slice(0, 1)}
                    </span>
                  )}
                  <div>
                    <p className="text-base font-semibold">{a.name}</p>
                    <p className="text-xs text-white/60">/{a.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-white/70">
                  <span>{a.event_count} events</span>
                  <span>{a.follower_count} followers</span>
                  {!a.active && (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide">Inactive</span>
                  )}
                </div>
              </div>
              {a.tagline && <p className="mt-2 text-sm text-white/70">{a.tagline}</p>}
            </Link>
          ))
        )}
      </section>

      <section className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-4">
        <p className="text-sm font-semibold">Add a new artist</p>
        <p className="mt-1 text-xs text-white/60">
          Slug is the URL segment (lowercase letters, digits, dashes). Can&apos;t be changed later.
        </p>
        <form action={createArtistAction} className="mt-3 flex flex-wrap gap-2">
          <input
            name="slug"
            required
            placeholder="slug (e.g. kacey)"
            className="flex-1 min-w-[160px] rounded-full border border-white/15 bg-black/40 px-3 py-2 text-sm"
          />
          <input
            name="name"
            required
            placeholder="Display name"
            className="flex-1 min-w-[160px] rounded-full border border-white/15 bg-black/40 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-full bg-gradient-to-r from-aurora to-ember px-5 py-2 text-sm font-semibold text-white"
          >
            Create
          </button>
        </form>
      </section>
    </div>
  );
}
