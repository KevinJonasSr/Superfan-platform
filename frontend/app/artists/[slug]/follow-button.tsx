"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toggleFollowAction } from "./follow-actions";

export default function FollowButton({
  artistSlug,
  initialFollowing,
}: {
  artistSlug: string;
  initialFollowing: boolean;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, startTransition] = useTransition();

  async function handleClick() {
    // Optimistic flip so the button feels instant
    const next = !following;
    setFollowing(next);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("artist_slug", artistSlug);
      fd.set("follow", String(next));
      try {
        await toggleFollowAction(fd);
        router.refresh();
      } catch {
        setFollowing(!next);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className={`rounded-full px-6 py-3 text-sm font-semibold transition disabled:opacity-50 ${
        following
          ? "border border-emerald-500/50 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30"
          : "border border-white/30 bg-white/10 text-white hover:bg-white/15"
      }`}
    >
      {following ? "✓ Following" : "+ Follow"}
    </button>
  );
}
