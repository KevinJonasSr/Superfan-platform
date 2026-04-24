import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import { listArtists } from "@/lib/artists";
import { getArtistFromDb } from "@/lib/data/artists";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface Founder {
  fan_id: string;
  founder_number: number;
  first_name: string | null;
  avatar_url: string | null;
  joined_at: string;
}

export async function generateStaticParams() {
  return listArtists().map((a) => ({ slug: a.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const artist = await getArtistFromDb(slug);
  if (!artist) return { title: "Founder Wall · Fan Engage" };
  return {
    title: `Founding Fans · ${artist.name} · Fan Engage`,
    description: `See the founding fans of ${artist.name} — the first paying community members with locked-in pricing for life.`,
  };
}

async function getFoundersForCommunity(
  communitySlug: string,
): Promise<{ founders: Founder[]; founderCap: number } | null> {
  try {
    const admin = createAdminClient();

    // Fetch community to get founder_cap
    const { data: community, error: communityError } = await admin
      .from("communities")
      .select("founder_cap")
      .eq("slug", communitySlug)
      .maybeSingle();

    if (communityError || !community) return null;

    // Fetch founders ordered by founder_number
    const { data: memberships, error: membershipsError } = await admin
      .from("fan_community_memberships")
      .select(
        `
        fan_id,
        founder_number,
        joined_at,
        fans:fans (
          id,
          first_name,
          avatar_url
        )
      `,
      )
      .eq("community_id", communitySlug)
      .eq("is_founder", true)
      .order("founder_number", { ascending: true });

    if (membershipsError || !memberships) return null;

    const founders: Founder[] = (memberships ?? [])
      .map((row: any) => {
        const fan = Array.isArray(row.fans) ? row.fans[0] : row.fans || {};
        return {
          fan_id: row.fan_id,
          founder_number: row.founder_number,
          first_name: fan.first_name,
          avatar_url: fan.avatar_url,
          joined_at: row.joined_at,
        };
      })
      .filter((f) => f.founder_number !== null);

    return {
      founders,
      founderCap: (community.founder_cap as number) ?? 100,
    };
  } catch {
    return null;
  }
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function getInitial(name: string | null): string {
  if (!name) return "?";
  return name.charAt(0).toUpperCase();
}

export default async function FounderWallPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [artist, founderData] = await Promise.all([
    getArtistFromDb(slug),
    getFoundersForCommunity(slug),
  ]);

  if (!artist) notFound();
  if (!founderData) notFound();

  const { founders, founderCap } = founderData;
  const claimedCount = founders.length;
  const remainingCount = founderCap - claimedCount;
  const isFull = remainingCount <= 0;

  const heroGradient = `linear-gradient(to bottom right, ${artist.accentFrom}66, #0f172a, #000000)`;
  const numberGradient = (index: number) =>
    `linear-gradient(135deg, ${artist.accentFrom}, ${artist.accentTo})`;

  return (
    <main className="mx-auto max-w-7xl space-y-10 px-6 py-12">
      {/* Hero */}
      <section
        className="relative overflow-hidden rounded-3xl border border-white/10 p-10"
        style={{ backgroundImage: heroGradient }}
      >
        <p className="text-xs uppercase tracking-[0.3em] text-white/60">
          Founding Fans
        </p>
        <h1
          className="mt-3 text-4xl font-semibold leading-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Founding Fans of {artist.name}
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-white/80">
          The first {founderCap} paying fans — locked-in pricing for life
        </p>
      </section>

      {/* Scarcity Counter */}
      <section className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm text-white/60">Founder slots</p>
            <p className="mt-1 text-3xl font-semibold">
              {claimedCount} <span className="text-lg text-white/60">/ {founderCap}</span>
            </p>
          </div>
          <div className="text-right">
            {isFull ? (
              <p className="text-sm font-semibold text-amber-400">
                All founder slots claimed
              </p>
            ) : (
              <>
                <p className="text-3xl font-semibold text-emerald-400">
                  {remainingCount}
                </p>
                <p className="mt-1 text-xs text-white/60">
                  {remainingCount === 1 ? "spot" : "spots"} remaining
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Founders Grid or Empty State */}
      {founders.length === 0 ? (
        <section className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-12 text-center">
          <p className="text-lg font-semibold">Be the first.</p>
          <p className="mt-2 text-sm text-white/70">
            Founder slots #{1}-{founderCap} are up for grabs. Claim yours and lock in
            premium pricing for life.
          </p>
          <Link
            href="/premium"
            className="mt-6 inline-block rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:brightness-110"
          >
            Become a Founding Fan →
          </Link>
        </section>
      ) : (
        <section>
          <p className="mb-6 text-sm text-white/60">
            {claimedCount} {claimedCount === 1 ? "founder" : "founders"}
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
            {founders.map((founder) => (
              <div
                key={founder.fan_id}
                className="group rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4 text-center transition hover:bg-white/10 hover:border-white/20"
              >
                {/* Founder Number */}
                <div
                  className="relative mb-3 text-2xl font-bold text-transparent bg-clip-text"
                  style={{ backgroundImage: numberGradient(founder.founder_number) }}
                >
                  #{founder.founder_number}
                </div>

                {/* Avatar */}
                <div className="mb-3 flex justify-center">
                  {founder.avatar_url ? (
                    <Image
                      src={founder.avatar_url}
                      alt={founder.first_name || `Founder #${founder.founder_number}`}
                      width={56}
                      height={56}
                      className="rounded-full object-cover border border-white/10 group-hover:border-white/20"
                    />
                  ) : (
                    <div
                      className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 group-hover:border-white/20 text-lg font-semibold text-white/70"
                      style={{
                        backgroundImage: `linear-gradient(135deg, ${artist.accentFrom}20, ${artist.accentTo}20)`,
                      }}
                    >
                      {getInitial(founder.first_name)}
                    </div>
                  )}
                </div>

                {/* Name */}
                <p className="text-sm font-semibold text-white truncate">
                  {founder.first_name || `Founder #${founder.founder_number}`}
                </p>

                {/* Joined date */}
                <p className="mt-2 text-xs text-white/50">
                  Member since {formatDate(founder.joined_at)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CTA at the bottom */}
      <section className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-8 text-center">
        <p className="text-lg font-semibold">
          {isFull
            ? "Standard Premium available"
            : "Want to be a Founding Fan?"}
        </p>
        <p className="mt-2 text-sm text-white/70">
          {isFull
            ? "All founder slots are claimed. Join as a Standard Premium fan to access the same perks."
            : "Join the first founding fans with locked-in pricing for life."}
        </p>
        <Link
          href="/premium"
          className="mt-6 inline-block rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:brightness-110"
        >
          {isFull ? "Standard Premium →" : "Become a Founding Fan →"}
        </Link>
      </section>

      {/* Back link */}
      <div className="text-center">
        <Link
          href={`/artists/${slug}`}
          className="text-xs text-white/50 hover:text-white/70 transition"
        >
          ← Back to {artist.name}
        </Link>
      </div>
    </main>
  );
}
