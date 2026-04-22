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
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(formData: FormData) {
    setSubmitting(true);
    try {
      formData.set("hero_image", heroImage ?? "");
      formData.set("accent_from", accentFrom);
      formData.set("accent_to", accentTo);
      await updateArtistAction(formData);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form action={handleSubmit} className="glass-card space-y-4 p-5">
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
        style={{ backgroundImage: `linear-gradient(to bottom right, ${accentFrom}66, #0f172a, #000000)` }}
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

      <div className="flex items-center justify-between pt-2">
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
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-gradient-to-r from-aurora to-ember px-6 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Save changes"}
        </button>
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
