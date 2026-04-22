import Link from "next/link";
import { listArtists } from "@/lib/artists";

export const metadata = {
  title: "Artists · Fan Engage",
};

export default function ArtistsIndexPage() {
  const artists = listArtists();
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
            className="group relative overflow-hidden rounded-3xl border border-white/10 p-6 transition hover:border-white/30"
            style={{
              backgroundImage: `linear-gradient(to bottom right, ${a.accentFrom}4D, #0f172a, #000000)`,
            }}
          >
            <p className="text-xs uppercase tracking-[0.3em] text-white/60">
              {a.genres.join(" · ")}
            </p>
            <h2
              className="mt-3 text-2xl font-semibold"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {a.name}
            </h2>
            <p className="mt-2 text-sm text-white/70">{a.tagline}</p>
            <span className="mt-8 inline-flex text-sm text-white/80 group-hover:text-white">
              Enter fan club →
            </span>
          </Link>
        ))}
      </section>
    </main>
  );
}
