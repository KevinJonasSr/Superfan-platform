import Link from "next/link";
import { listArtistsFromDb } from "@/lib/data/artists";

export const metadata = {
  title: "Artists · Fan Engage",
};

export const dynamic = "force-dynamic";

export default async function ArtistsIndexPage() {
  const artists = await listArtistsFromDb();
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-12">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-white/60">Artists</p>
        <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          Fan clubs on Fan Engage
        </h1>
        <p className="max-w-2xl text-sm text-white/70">
          Each artist has a dedicated hub with rewards, drops, and backstage access for their superfans.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {artists.map((a) => (
          <Link
            key={a.slug}
            href={`/artists/${a.slug}`}
            className="group relative overflow-hidden rounded-3xl border border-white/10 transition hover:border-white/30 hover:-translate-y-0.5"
          >
            {/* 3:4 portrait poster — same shape as the Fan Home strip cards
                so the visual language stays consistent across the app. */}
            <div className="relative aspect-[3/4] w-full bg-black/40">
              {a.heroImage ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.heroImage}
                    alt=""
                    // object-top keeps the subject's head visible — default
                    // object-cover crops top + bottom equally, slicing heads.
                    className="absolute inset-0 h-full w-full object-cover object-top transition duration-500 group-hover:scale-[1.04]"
                    aria-hidden
                  />
                </>
              ) : (
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: `linear-gradient(to bottom right, ${a.accentFrom}, ${a.accentTo})`,
                  }}
                  aria-hidden
                />
              )}

              {/* Dark gradient overlay so the text stays readable on any photo */}
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage:
                    "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.45) 50%, rgba(0,0,0,0) 100%)",
                }}
                aria-hidden
              />

              {/* Top-left genre chip */}
              {a.genres.length > 0 && (
                <p className="absolute left-5 top-5 rounded-full border border-white/15 bg-black/45 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-white/85 backdrop-blur">
                  {a.genres.join(" · ")}
                </p>
              )}

              {/* Bottom-left content: name + tagline + CTA arrow */}
              <div className="absolute inset-x-0 bottom-0 p-5">
                <h2
                  className="text-2xl font-semibold text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {a.name}
                </h2>
                {a.tagline && (
                  <p className="mt-1 line-clamp-2 text-sm text-white/85 drop-shadow-[0_1px_6px_rgba(0,0,0,0.5)]">
                    {a.tagline}
                  </p>
                )}
                <span className="mt-3 inline-flex text-sm text-white/90 transition group-hover:text-white">
                  Enter fan club →
                </span>
              </div>
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}
