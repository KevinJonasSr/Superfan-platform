"use client";

import type { FanActionRow } from "@/lib/data/campaigns";
import { completeFanActionAction } from "./cta-actions";

const KIND_ICON: Record<string, string> = {
  pre_save: "🎵",
  stream: "▶️",
  share: "🔁",
  radio_request: "📻",
  playlist_add: "➕",
  social_follow: "👥",
  custom: "✨",
};

export default function FanCtaBlock({
  artistSlug,
  actions,
  signedIn,
}: {
  artistSlug: string;
  actions: FanActionRow[];
  signedIn: boolean;
}) {
  if (actions.length === 0) return null;

  return (
    <section className="rounded-3xl border border-purple-500/30 bg-gradient-to-br from-purple-900/30 via-slate-900 to-midnight p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-white/60">Earn points</p>
          <h2
            className="mt-1 text-xl font-semibold"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Active campaign actions
          </h2>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {actions.map((a) => (
          <div
            key={a.id}
            className={`rounded-2xl border p-4 ${
              a.completed
                ? "border-emerald-500/40 bg-emerald-500/10"
                : "border-white/10 bg-black/30"
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-lg">
                {KIND_ICON[a.kind] ?? "✨"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{a.title}</p>
                {a.description && (
                  <p className="mt-0.5 text-xs text-white/70">{a.description}</p>
                )}
                <p className="mt-1 text-[11px] text-emerald-300">
                  +{a.point_value} pts on completion
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-end gap-2">
              {a.url && (
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-white/60 hover:text-white"
                >
                  Open link ↗
                </a>
              )}
              {a.completed ? (
                <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs text-emerald-200">
                  ✓ Completed
                </span>
              ) : signedIn ? (
                <form
                  action={completeFanActionAction}
                  onSubmit={() => {
                    // Open the URL in a new tab at the same moment we mark complete.
                    if (a.url) window.open(a.url, "_blank", "noopener,noreferrer");
                  }}
                >
                  <input type="hidden" name="action_id" value={a.id} />
                  <input type="hidden" name="artist_slug" value={artistSlug} />
                  <button className="rounded-full bg-gradient-to-r from-aurora to-ember px-4 py-1.5 text-xs font-semibold text-white">
                    {a.cta_label}
                  </button>
                </form>
              ) : (
                <span className="text-xs text-white/50">Sign in to complete</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
