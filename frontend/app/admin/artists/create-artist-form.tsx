"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFormSave, SaveStatusIndicator } from "@/lib/use-form-save";
import { createArtistAction } from "./actions";

/**
 * Inline "Add a new artist" form on /admin/artists. Wrapped in useFormSave
 * for retry-on-503 + visible status, navigates to the new artist's edit
 * page on success.
 */
export default function CreateArtistForm() {
  const router = useRouter();
  const [businessError, setBusinessError] = useState<string | null>(null);
  const { status, submit, submitting } = useFormSave();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusinessError(null);
    const fd = new FormData(e.currentTarget);
    const result = await submit(createArtistAction, fd);
    if (result?.success) {
      // Reset the form for a clean state on the destination page (Next will
      // unmount this component on navigation, but be tidy).
      e.currentTarget.reset();
      router.push(`/admin/artists/${result.slug}`);
    } else if (result?.error) {
      setBusinessError(result.error);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 flex flex-wrap items-center gap-2"
    >
      <input
        name="slug"
        required
        placeholder="slug (e.g. kacey)"
        className="flex-1 min-w-[160px] rounded-full border border-white/15 bg-black/40 px-3 py-2 text-sm"
      />
      <input
        name="name"
        required
        placeholder="Display name"
        className="flex-1 min-w-[160px] rounded-full border border-white/15 bg-black/40 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-gradient-to-r from-aurora to-ember px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {submitting ? "Creating…" : "Create"}
      </button>
      <SaveStatusIndicator status={status} />
      {businessError && (
        <span className="text-xs text-rose-300" title={businessError}>
          ✗ {businessError}
        </span>
      )}
    </form>
  );
}
