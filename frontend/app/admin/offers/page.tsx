import { createAdminClient } from "@/lib/supabase/admin";
import type { Offer } from "@/lib/data/types";
import { createOfferAction, toggleOfferActiveAction } from "./actions";

async function listAllOffers(): Promise<Offer[]> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("offers")
      .select("*")
      .order("created_at", { ascending: false });
    return (data ?? []) as Offer[];
  } catch {
    return [];
  }
}

export default async function AdminOffersPage() {
  const offers = await listAllOffers();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
            Offers
          </h1>
          <p className="mt-2 text-sm text-white/60">
            Active offers appear on the marketplace. Inactive ones are hidden but not deleted.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
        <h2 className="text-sm uppercase tracking-wide text-white/60">Add a new offer</h2>
        <form action={createOfferAction} className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            name="title"
            placeholder="Signed vinyl"
            required
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
          />
          <input
            name="slug"
            placeholder="signed-vinyl"
            required
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
          />
          <select
            name="category"
            required
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
            defaultValue="merch"
          >
            <option value="merch">Merch</option>
            <option value="experience">Experience</option>
            <option value="collectible">Collectible</option>
            <option value="digital">Digital</option>
            <option value="ticket">Ticket</option>
          </select>
          <select
            name="min_tier"
            required
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
            defaultValue="bronze"
          >
            <option value="bronze">Bronze+</option>
            <option value="silver">Silver+</option>
            <option value="gold">Gold+</option>
            <option value="platinum">Platinum</option>
          </select>
          <input
            name="price_points"
            type="number"
            min={0}
            placeholder="Price in points"
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
          />
          <input
            name="inventory"
            type="number"
            min={0}
            placeholder="Inventory (optional)"
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
          />
          <textarea
            name="description"
            placeholder="Description"
            rows={2}
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm md:col-span-2"
          />
          <button
            type="submit"
            className="rounded-full bg-gradient-to-r from-aurora to-ember px-4 py-2 text-sm font-semibold text-white md:col-span-2"
          >
            Create offer
          </button>
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-black/40 text-left text-xs uppercase tracking-wide text-white/50">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Min tier</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {offers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-white/50">
                  No offers yet — create one above.
                </td>
              </tr>
            )}
            {offers.map((o) => (
              <tr key={o.id} className="border-t border-white/5">
                <td className="px-4 py-3">{o.title}</td>
                <td className="px-4 py-3 capitalize">{o.category}</td>
                <td className="px-4 py-3 capitalize">{o.min_tier}</td>
                <td className="px-4 py-3">
                  {o.price_points
                    ? `${o.price_points} pts`
                    : o.price_cents != null
                      ? `$${(o.price_cents / 100).toFixed(2)}`
                      : "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs ${
                      o.active ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/50"
                    }`}
                  >
                    {o.active ? "active" : "hidden"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <form action={toggleOfferActiveAction}>
                    <input type="hidden" name="id" value={o.id} />
                    <input type="hidden" name="active" value={String(!o.active)} />
                    <button className="text-xs text-white/70 hover:text-white">
                      {o.active ? "Hide" : "Activate"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
