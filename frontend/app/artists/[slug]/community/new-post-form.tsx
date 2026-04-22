"use client";

import { useRef, useState } from "react";
import { createPostAction } from "./actions";

export default function NewPostForm({ artistSlug }: { artistSlug: string }) {
  const [submitting, setSubmitting] = useState(false);
  const [showImage, setShowImage] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setSubmitting(true);
    try {
      await createPostAction(formData);
      formRef.current?.reset();
      setShowImage(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="glass-card space-y-3 p-5"
    >
      <input type="hidden" name="artist_slug" value={artistSlug} />
      <textarea
        name="body"
        required
        maxLength={2000}
        placeholder="What's on your mind? Share with the community…"
        rows={3}
        className="w-full resize-none rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
      />
      {showImage && (
        <input
          type="url"
          name="image_url"
          placeholder="https://image.url/example.jpg"
          className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-2 text-sm text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
        />
      )}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setShowImage((v) => !v)}
          className="text-xs text-white/60 hover:text-white"
        >
          {showImage ? "− Remove image" : "+ Add image URL"}
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-gradient-to-r from-aurora to-ember px-5 py-2 text-sm font-semibold text-white shadow-glass transition hover:brightness-110 disabled:opacity-50"
        >
          {submitting ? "Posting…" : "Post · +5 pts"}
        </button>
      </div>
    </form>
  );
}
