"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ImageUploader from "@/components/image-uploader";
import { updateArtistAction } from "../actions";

type InitialValues = {
  name: string;
  tagline: string;
  bio: string;
  heroImage: string | null;
  accentFrom: string;
  accentTo: string;
  genresText: string;
  socialText: string;
  active: boolean;
  sortOrder: number;
};

type SaveStatus =
  | { kind: "idle" }
  | { kind: "saving"; attempt: number }
  | { kind: "saved" }
  | { kind: "error"; message: string };

export default function ArtistEditForm({
  slug,
  initial,
}: {
  slug: string;
  initial: InitialValues;
}) {
  const router = useRouter();
  const [heroImage, setHeroImage] = useState<string | null>(initial.heroImage);
  const [accentFrom, setAccentFrom] = useState(initial.accentFrom);
  const [accentTo, setAccentTo] = useState(initial.accentTo);
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });

  const submitting = status.kind === "saving";

  // Use a plain onSubmit handler (instead of <form action={fn}>) so the submit
  // event is reliably intercepted by React. Wrap the action call in retry +
  // explicit error feedback because Vercel Server Actions silently swallow
  // 503 cold-start failures otherwise — the form would appear to "save" but
  // the data wouldn't persist.
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus({ kind: "saving", attempt: 1 });

    const formData = new FormData(e.currentTarget);
    formData.set("hero_image", heroImage ?? "");
    formData.set("accent_from", accentFrom);
    formData.set("accent_to", accentTo);

    const maxAttempts = 3;
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      setStatus({ kind: "saving", attempt });
      try {
        await callActionWithFetchProbe(formData);
        // Success — refresh and show toast.
        setStatus({ kind: "saved" });
        router.refresh();
        // Auto-clear the success toast after 3s
        setTimeout(() => {
          setStatus((s) => (s.kind === "saved" ? { kind: "idle" } : s));
        }, 3000);
        return;
      } catch (err) {
        lastError = err;
        // Backoff: 600ms, 1500ms before next try.
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, attempt === 1 ? 600 : 1500));
        }
      }
    }

    setStatus({
      kind: "error",
      message:
        lastError instanceof Error
          ? lastError.message
          : "Save failed after 3 attempts. Try again in a moment.",
    });
  }

  /**
   * Call updateArtistAction, but probe the underlying Server Action POST
   * via a fetch interceptor so we can detect 503s that React would otherwise
   * swallow silently. If the POST returned non-2xx, throw so the retry loop
   * picks it up.
   */
  async function callActionWithFetchProbe(formData: FormData) {
    let lastStatus: number | null = null;
    const origFetch = window.fetch;
    window.fetch = async function (...args) {
      const res = await origFetch.apply(this, args as Parameters<typeof fetch>);
      // Only inspect requests to this page (where the Server Action POSTs).
      const url = String(args[0] || "");
      if (
        url.includes("/admin/artists/") &&
        !url.includes("?_rsc")
      ) {
        lastStatus = res.status;
      }
      return res;
    };
    try {
      await updateArtistAction(formData);
      if (lastStatus !== null && lastStatus >= 500) {
        throw new Error(`Server returned ${lastStatus}`);
      }
    } finally {
      window.fetch = origFetch;
    }
  }

  return (
    <form onSubmit={handleSubmit} className="glass-card space-y-4 p-5">
      <input type="hidden" name="slug" value={slug} />
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Display name">
          <input
            name="name"
            required
            defaultValue={initial.name}
            className="w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Tagline">
          <input
            name="tagline"
            defaultValue={initial.tagline}
            placeholder="Short one-liner under the name"
            className="w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
          />
        </Field>
      </div>
      <Field label="Bio">
        <textarea
          name="bio"
          rows={4}
          defaultValue={initial.bio}
          placeholder="What fans read on the artist page."
          className="w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Hero image">
        <ImageUploader
          bucket="community-uploads"
          name="hero_image_unused"
          initialUrl={heroImage}
          label={heroImage ? "Replace hero" : "Upload hero image"}
          onUploaded={setHeroImage}
        />
      </Field>
      <div className="grid gap-3 md:grid-cols-4">
        <Field label="Accent from">
          <input
            type="color"
            value={accentFrom}
            onChange={(e) => setAccentFrom(e.target.value)}
            className="h-10 w-full cursor-pointer rounded-2xl border border-white/10 bg-black/40 p-1"
          />
        </Field>
        <Field label="Accent to">
          <input
            type="color"
            value={accentTo}
            onChange={(e) => setAccentTo(e.target.value)}
            className="h-10 w-full cursor-pointer rounded-2xl border border-white/10 bg-black/40 p-1"
          />
        </Field>
        <Field label="Genres">
          <input
            name="genres"
            defaultValue={initial.genresText}
            placeholder="Country, Rock"
            className="w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Sort order">
          <input
            name="sort_order"
            type="number"
            defaultValue={initial.sortOrder}
            className="w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
          />
        </Field>
      </div>
      {/* Live preview of accent gradient */}
      <div
        className="rounded-2xl border border-white/10 p-4"
        style={{
          backgroundImage: `linear-gradient(to bottom right, ${accentFrom}66, #0f172a, #000000)`
        }}
      >
        <p className="text-xs uppercase tracking-[0.3em] text-white/60">{initial.genresText}</p>
        <p
          className="mt-2 text-2xl font-semibold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {initial.name}
        </p>
        <p className="text-sm text-white/70">{initial.tagline}</p>
        <span
          className="mt-3 inline-flex rounded-full px-4 py-1.5 text-xs font-semibold text-white"
          style={{ backgroundImage: `linear-gradient(to right, ${accentFrom}, ${accentTo})` }}
        >
          CTA preview
        </span>
      </div>
      <Field label="Social links">
        <textarea
          name="social"
          rows={3}
          defaultValue={initial.socialText}
          placeholder="Format: Label | URL (one per line)&#10;Instagram | https://instagram.com/artist&#10;TikTok | https://tiktok.com/@artist"
          className="w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
        />
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <label className="flex items-center gap-2 text-xs text-white/70">
          <input
            type="checkbox"
            name="active"
            value="true"
            defaultChecked={initial.active}
            className="h-4 w-4 accent-aurora"
          />
          Active (visible to fans)
        </label>
        <div className="flex flex-wrap items-center gap-3">
          {/* Status indicator */}
          {status.kind === "saving" && (
            <span className="text-xs text-white/60">
              Saving{status.attempt > 1 ? ` — retrying (${status.attempt}/3)` : "…"}
            </span>
          )}
          {status.kind === "saved" && (
            <span className="text-xs text-emerald-300">✓ Saved</span>
          )}
          {status.kind === "error" && (
            <span
              className="text-xs text-rose-300"
              title={status.message}
            >
              ✗ {status.message}
            </span>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-gradient-to-r from-aurora to-ember px-6 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-white/60">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
