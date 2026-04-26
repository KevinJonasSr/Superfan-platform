"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFormSave, SaveStatusIndicator } from "@/lib/use-form-save";
import { updateRewardAction } from "../actions";

interface RewardRow {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  point_cost: number;
  kind: string;
  stock: number | null;
  active: boolean;
  requires_tier: string | null;
}

/**
 * Client form for /admin/rewards/[id]. Uses useFormSave for retry-on-503
 * + visible status. updateRewardAction now returns { success } instead of
 * server-side redirecting, so the retry wrapper can catch real failures.
 */
export default function EditRewardForm({ reward }: { reward: RewardRow }) {
  const router = useRouter();
  const [businessError, setBusinessError] = useState<string | null>(null);
  const { status, submit, submitting } = useFormSave();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusinessError(null);
    const fd = new FormData(e.currentTarget);
    const result = await submit(updateRewardAction, fd);
    if (result?.success) {
      router.push("/admin/rewards");
    } else if (result?.error) {
      setBusinessError(result.error);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="glass-card space-y-4 rounded-2xl p-6"
    >
      <input type="hidden" name="id" value={reward.id} />

      <div>
        <label className="block text-sm font-medium">Title *</label>
        <input
          type="text"
          name="title"
          required
          defaultValue={reward.title}
          className="mt-2 w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-white focus:border-white/30 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Description</label>
        <textarea
          name="description"
          defaultValue={reward.description || ""}
          className="mt-2 w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-white focus:border-white/30 focus:outline-none"
          rows={3}
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Image URL</label>
        <input
          type="url"
          name="image_url"
          defaultValue={reward.image_url || ""}
          className="mt-2 w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-white focus:border-white/30 focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Point Cost *</label>
          <input
            type="number"
            name="point_cost"
            required
            min="1"
            defaultValue={reward.point_cost}
            className="mt-2 w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-white focus:border-white/30 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Kind *</label>
          <select
            name="kind"
            required
            defaultValue={reward.kind}
            className="mt-2 w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-white focus:border-white/30 focus:outline-none"
          >
            <option value="voice_note">Voice Note</option>
            <option value="video_shoutout">Video Shoutout</option>
            <option value="merch_discount">Merch Discount</option>
            <option value="early_access">Early Access</option>
            <option value="experience">Experience</option>
            <option value="custom">Custom</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Stock</label>
          <input
            type="number"
            name="stock"
            min="0"
            defaultValue={reward.stock || ""}
            className="mt-2 w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-white focus:border-white/30 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Requires Tier</label>
          <select
            name="requires_tier"
            defaultValue={reward.requires_tier || ""}
            className="mt-2 w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-white focus:border-white/30 focus:outline-none"
          >
            <option value="">None</option>
            <option value="premium">Premium</option>
            <option value="founder-only">Founder Only</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          name="active"
          id="active"
          defaultChecked={reward.active}
          className="rounded border border-white/30"
        />
        <label htmlFor="active" className="text-sm font-medium">
          Active
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-6">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 px-4 py-2 font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Save Changes"}
        </button>
        <SaveStatusIndicator status={status} />
        {businessError && (
          <span className="text-xs text-rose-300" title={businessError}>
            ✗ {businessError}
          </span>
        )}
      </div>
    </form>
  );
}
