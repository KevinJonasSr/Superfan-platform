"use client";

import { useRef, useState } from "react";
import ImageUploader from "@/components/image-uploader";
import {
  createAnnouncementAction,
  createChallengeAction,
  createPollAction,
  createPostAction,
} from "./actions";

type Kind = "post" | "announcement" | "poll" | "challenge";

export default function NewPostForm({
  artistSlug,
  isAdmin,
}: {
  artistSlug: string;
  isAdmin: boolean;
}) {
  const [kind, setKind] = useState<Kind>("post");
  const [submitting, setSubmitting] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [visibility, setVisibility] = useState<"public" | "premium">("public");
  // Bump this key to force-remount the ImageUploader after a submit (which
  // clears its internal state + hidden input).
  const [uploaderKey, setUploaderKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  function resetForm() {
    formRef.current?.reset();
    setPollOptions(["", ""]);
    setVisibility("public");
    setUploaderKey((k) => k + 1);
  }

  async function handleSubmit(formData: FormData) {
    setSubmitting(true);
    try {
      // Admins can flag a post Premium-only; non-admins never get this option
      // in the UI, and the server action also rejects it on fan-created posts.
      if (isAdmin && kind !== "post") {
        formData.set("visibility", visibility);
      }

      if (kind === "poll") {
        // Replace generic option[] entries with our state-tracked ones so admins
        // can add/remove option inputs dynamically.
        formData.delete("option");
        for (const opt of pollOptions) {
          const v = opt.trim();
          if (v) formData.append("option", v);
        }
        await createPollAction(formData);
      } else if (kind === "announcement") {
        await createAnnouncementAction(formData);
      } else if (kind === "challenge") {
        await createChallengeAction(formData);
      } else {
        await createPostAction(formData);
      }
      resetForm();
      setKind("post");
    } finally {
      setSubmitting(false);
    }
  }

  const submitLabel =
    kind === "poll"
      ? "Publish poll"
      : kind === "announcement"
        ? "Publish announcement"
        : kind === "challenge"
          ? "Publish challenge"
          : "Post · +5 pts";

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="glass-card space-y-3 p-5"
    >
      <input type="hidden" name="artist_slug" value={artistSlug} />

      {isAdmin && (
        <div className="flex flex-wrap items-center gap-2">
          {(["post", "announcement", "poll", "challenge"] as Kind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-full border px-3 py-1 text-xs capitalize transition ${
                kind === k
                  ? "border-aurora/60 bg-aurora/20 text-white"
                  : "border-white/10 bg-black/30 text-white/70 hover:bg-black/50"
              }`}
            >
              {k === "post" ? "Post" : k === "announcement" ? "📢 Announcement" : k === "poll" ? "📊 Poll" : "🏆 Challenge"}
            </button>
          ))}
          {kind !== "post" && (
            <button
              type="button"
              onClick={() =>
                setVisibility((v) => (v === "public" ? "premium" : "public"))
              }
              title={
                visibility === "premium"
                  ? "Visible only to Premium fans — click to make public"
                  : "Visible to everyone — click to make Premium-only"
              }
              className={`ml-auto rounded-full border px-3 py-1 text-xs font-semibold transition ${
                visibility === "premium"
                  ? "border-amber-300/70 bg-gradient-to-r from-aurora/30 to-ember/30 text-white"
                  : "border-white/15 bg-black/30 text-white/60 hover:bg-black/50"
              }`}
            >
              {visibility === "premium" ? "⭐ Premium only" : "🌐 Public"}
            </button>
          )}
        </div>
      )}

      {(kind === "announcement" || kind === "challenge") && (
        <input
          type="text"
          name="title"
          maxLength={160}
          placeholder={
            kind === "announcement"
              ? "Announcement headline (optional)"
              : "Challenge title (optional)"
          }
          className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-2 text-sm text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
        />
      )}

      <textarea
        name="body"
        required
        maxLength={2000}
        placeholder={
          kind === "poll"
            ? "Ask a question… e.g. Which song should we play next?"
            : kind === "challenge"
              ? "Describe the challenge and what fans should submit…"
              : kind === "announcement"
                ? "Share an announcement with the community…"
                : "What's on your mind? Share with the community…"
        }
        rows={3}
        className="w-full resize-none rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
      />

      {kind === "poll" && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-white/50">Options</p>
          {pollOptions.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={opt}
                onChange={(e) => {
                  const next = [...pollOptions];
                  next[i] = e.target.value;
                  setPollOptions(next);
                }}
                maxLength={120}
                placeholder={`Option ${i + 1}`}
                className="flex-1 rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
              />
              {pollOptions.length > 2 && (
                <button
                  type="button"
                  onClick={() =>
                    setPollOptions(pollOptions.filter((_, idx) => idx !== i))
                  }
                  className="text-xs text-rose-300/80 hover:text-rose-300"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          {pollOptions.length < 6 && (
            <button
              type="button"
              onClick={() => setPollOptions([...pollOptions, ""])}
              className="text-xs text-white/60 hover:text-white"
            >
              + Add option
            </button>
          )}
        </div>
      )}

      {kind !== "poll" && (
        <ImageUploader
          key={uploaderKey}
          bucket="community-uploads"
          name="image_url"
          label={kind === "challenge" ? "Add cover photo" : "Add photo"}
        />
      )}

      <div className="flex items-center justify-between">
        {kind === "poll" ? (
          <span className="text-xs text-white/50">
            {pollOptions.filter((o) => o.trim()).length} of 6 options
          </span>
        ) : (
          <span />
        )}
        <button
          type="submit"
          disabled={
            submitting ||
            (kind === "poll" &&
              pollOptions.filter((o) => o.trim()).length < 2)
          }
          className="rounded-full bg-gradient-to-r from-aurora to-ember px-5 py-2 text-sm font-semibold text-white shadow-glass transition hover:brightness-110 disabled:opacity-50"
        >
          {submitting ? "Posting…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
