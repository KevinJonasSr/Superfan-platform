import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { listArtists } from "@/lib/artists";
import { getArtistFromDb } from "@/lib/data/artists";
import { getAdminUser } from "@/lib/admin";
import { getCurrentFan } from "@/lib/data/fan";
import { getActiveFanActionsForArtist } from "@/lib/data/campaigns";
import {
  getChallengeEntries,
  getCommentsByPost,
  getPollData,
  getPostsByArtist,
} from "@/lib/data/community";
import FanCtaBlock from "./fan-cta-block";
import NewPostForm from "./new-post-form";
import PostCard from "./post-card";

export async function generateStaticParams() {
  return listArtists().map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const artist = await getArtistFromDb(slug);
  if (!artist) return { title: "Community · Fan Engage" };
  return { title: `${artist.name} Community · Fan Engage` };
}

export default async function ArtistCommunityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const artist = await getArtistFromDb(slug);
  if (!artist) notFound();

  const [fan, posts, adminUser, fanActions] = await Promise.all([
    getCurrentFan(),
    getPostsByArtist(slug, 30),
    getAdminUser(),
    getActiveFanActionsForArtist(slug),
  ]);

  // Parallel-fetch comments + poll data + challenge entries for every visible
  // post so the feed renders in one round-trip. Fine at MVP scale; when post
  // counts per page get big we'll switch to on-expand fetching.
  const [commentsByPost, pollByPost, entriesByPost] = await Promise.all([
    Promise.all(posts.map((p) => getCommentsByPost(p.id))),
    Promise.all(
      posts.map((p) => (p.kind === "poll" ? getPollData(p.id) : Promise.resolve(null))),
    ),
    Promise.all(
      posts.map((p) =>
        p.kind === "challenge" ? getChallengeEntries(p.id) : Promise.resolve([]),
      ),
    ),
  ]);

  const isSignedIn = fan !== null;
  const isAdmin = adminUser !== null;

  const heroGradient = `linear-gradient(to bottom right, ${artist.accentFrom}40, #0f172a, #000000)`;

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
      <section
        className="rounded-3xl border border-white/10 p-8"
        style={{ backgroundImage: heroGradient }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/60">Community</p>
            <h1
              className="mt-2 text-3xl font-semibold"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {artist.name} community
            </h1>
            <p className="mt-3 text-sm text-white/75">
              Posts +5 pts · comments +2 pts · poll votes +1 pt · challenge
              entries +3 pts.
            </p>
          </div>
          <Link
            href={`/artists/${slug}`}
            className="rounded-full border border-white/20 px-4 py-2 text-xs text-white/70 hover:bg-white/10"
          >
            ← Artist page
          </Link>
        </div>
      </section>

      <FanCtaBlock artistSlug={slug} actions={fanActions} signedIn={isSignedIn} />

      {isSignedIn ? (
        <NewPostForm artistSlug={slug} isAdmin={isAdmin} />
      ) : (
        <section className="rounded-3xl border border-aurora/40 bg-gradient-to-r from-aurora/20 via-slate-900 to-ember/20 p-5">
          <p className="text-sm">
            Sign in to post in the {artist.name} community.
          </p>
          <div className="mt-3 flex gap-2">
            <Link
              href={`/login?next=/artists/${slug}/community`}
              className="rounded-full border border-white/20 px-4 py-2 text-xs text-white/80 hover:bg-white/10"
            >
              Sign in
            </Link>
            <Link
              href={`/signup`}
              className="rounded-full bg-gradient-to-r from-aurora to-ember px-4 py-2 text-xs font-semibold text-white shadow-glass"
            >
              Create account
            </Link>
          </div>
        </section>
      )}

      {posts.length === 0 ? (
        <section className="glass-card p-8 text-center">
          <p className="text-sm font-semibold">Nothing posted yet</p>
          <p className="mt-2 text-xs text-white/60">
            {isSignedIn
              ? "Be the first to post — earn 5 pts and kick off the conversation."
              : "Be the first in when the community fills up — sign in to post."}
          </p>
        </section>
      ) : (
        <div className="space-y-4">
          {posts.map((post, i) => (
            <PostCard
              key={post.id}
              post={post}
              initialComments={commentsByPost[i]}
              isAuthor={fan !== null && post.author_id === fan.id}
              isAdmin={isAdmin}
              currentUserId={fan?.id ?? null}
              poll={pollByPost[i]}
              challengeEntries={entriesByPost[i]}
            />
          ))}
        </div>
      )}
    </main>
  );
}
