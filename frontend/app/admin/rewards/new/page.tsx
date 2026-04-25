import { getAdminContext } from "@/lib/admin";
import { notFound, redirect } from "next/navigation";
import { createRewardAction } from "../actions";

export default async function NewRewardPage() {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/login?next=/admin/rewards/new");

  async function handleSubmit(formData: FormData) {
    "use server";
    const result = await createRewardAction(formData);
    if (result.success) {
      redirect("/admin/rewards");
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">Create Reward</h1>

      <form action={handleSubmit} className="glass-card space-y-4 rounded-2xl p-6">
        <div>
          <label className="block text-sm font-medium">Title *</label>
          <input
            type="text"
            name="title"
            required
            className="mt-2 w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-white placeholder-white/40 focus:border-white/30 focus:outline-none"
            placeholder="E.g., Personalized Voice Note"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Description</label>
          <textarea
            name="description"
            className="mt-2 w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-white placeholder-white/40 focus:border-white/30 focus:outline-none"
            placeholder="E.g., A personalized 30-second voice note"
            rows={3}
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Image URL</label>
          <input
            type="url"
            name="image_url"
            className="mt-2 w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-white placeholder-white/40 focus:border-white/30 focus:outline-none"
            placeholder="https://..."
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
              className="mt-2 w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-white focus:border-white/30 focus:outline-none"
              placeholder="5000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Kind *</label>
            <select
              name="kind"
              required
              className="mt-2 w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-white focus:border-white/30 focus:outline-none"
            >
              <option value="">Select kind</option>
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
            <label className="block text-sm font-medium">Stock (leave blank for unlimited)</label>
            <input
              type="number"
              name="stock"
              min="0"
              className="mt-2 w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-white focus:border-white/30 focus:outline-none"
              placeholder="10"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Requires Tier</label>
            <select
              name="requires_tier"
              className="mt-2 w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-white focus:border-white/30 focus:outline-none"
            >
              <option value="">None</option>
              <option value="premium">Premium</option>
              <option value="founder-only">Founder Only</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2 pt-6">
          <button
            type="submit"
            className="flex-1 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 px-4 py-2 font-medium text-white hover:opacity-90"
          >
            Create Reward
          </button>
        </div>
      </form>
    </div>
  );
}
