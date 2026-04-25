"use client";

import { useState } from "react";
import { redeemRewardAction } from "./actions";

interface RedeemFormProps {
  rewardId: string;
  rewardTitle: string;
  pointCost: number;
  onSuccess: () => void;
  onClose: () => void;
}

export function RedeemForm({
  rewardId,
  rewardTitle,
  pointCost,
  onSuccess,
  onClose,
}: RedeemFormProps) {
  const [deliveryDetails, setDeliveryDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("rewardId", rewardId);
    formData.append("deliveryDetails", deliveryDetails);

    const result = await redeemRewardAction(formData);

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    // Success
    onSuccess();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="glass-card w-full max-w-md rounded-2xl p-6">
        <h2 className="text-lg font-semibold">{rewardTitle}</h2>
        <p className="mt-1 text-sm text-white/60">Cost: {pointCost.toLocaleString()} points</p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-white/80">
              Delivery Details (optional)
            </label>
            <textarea
              value={deliveryDetails}
              onChange={(e) => setDeliveryDetails(e.target.value)}
              placeholder="E.g., shirt size, shipping address hint, etc."
              className="mt-2 w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white placeholder-white/40 focus:border-white/30 focus:outline-none"
              rows={3}
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/5 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Redeeming..." : "Confirm Redeem"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
