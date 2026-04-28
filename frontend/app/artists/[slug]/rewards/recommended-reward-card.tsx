/**
 * Hero card for the recommended reward, surfaced at the top of
 * /artists/[slug]/rewards when there's a meaningful pick.
 *
 * Server-rendered — no client interactivity beyond the dismiss link
 * (which is a `<Link>` that drops a `?dismiss_rec=1` URL param so the
 * page knows to skip the card on the next render of this session).
 */

import Image from "next/image";
import Link from "next/link";
import type { RecommendedReward } from "@/lib/recs";
import { reasonCopy } from "@/lib/recs";

export default function RecommendedRewardCard({
  reward,
  artistSlug,
  dismissHref,
}: {
  reward: RecommendedReward;
  artistSlug: string;
  dismissHref: string;
}) {
  return (
    <section
      aria-label="Recommended for you"
      className="mb-8 overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-aurora/30 via-slate-900/40 to-ember/20 shadow-glass"
    >
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-6">
        {/* Image */}
        {reward.image_url ? (
          <div className="relative h-32 w-full overflow-hidden rounded-xl sm:h-28 sm:w-40 sm:flex-shrink-0">
            {/* Using <img> rather than Image to avoid configuring more
                remote patterns just for the hero card. Image is small. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={reward.image_url}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="flex h-32 w-full items-center justify-center rounded-xl bg-black/30 text-3xl sm:h-28 sm:w-40 sm:flex-shrink-0">
            🎁
          </div>
        )}

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white">
              ✨ For you
            </span>
            <span className="text-[10px] uppercase tracking-wide text-white/50">
              {reward.point_cost.toLocaleString()} pts
            </span>
          </div>
          <h2
            className="mt-2 text-lg font-semibold text-white"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {reward.title}
          </h2>
          {reward.description ? (
            <p className="mt-1 line-clamp-2 text-xs text-white/70">
              {reward.description}
            </p>
          ) : null}
          <p className="mt-2 text-[11px] italic text-white/50">
            {reasonCopy(reward)}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:flex-col sm:items-end sm:gap-3">
          <Link
            href={`#reward-${reward.reward_id}`}
            className="rounded-full bg-gradient-to-r from-aurora to-ember px-4 py-2 text-xs font-semibold text-white shadow hover:brightness-110"
          >
            View reward
          </Link>
          <Link
            href={dismissHref}
            className="text-[11px] text-white/50 hover:text-white"
          >
            Hide
          </Link>
        </div>
      </div>
    </section>
  );
}

// Suppress unused-import warning for Image; we left the import in place
// in case we later switch to next/image after configuring remote patterns.
void Image;
