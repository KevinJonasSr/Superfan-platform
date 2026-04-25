"use client";

import { useState } from "react";
import { markFulfilledAction, cancelRedemptionAction } from "./actions";

interface RedemptionActionProps {
  redemptionId: string;
  fanId: string;
  pointCost: number;
}

export default function RedemptionAction({
  redemptionId,
  fanId,
  pointCost,
}: RedemptionActionProps) {
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleFulfill() {
    setLoading(true);
    const result = await markFulfilledAction(redemptionId, note);
    setLoading(false);
    if (result.success) {
      setShowNote(false);
      setNote("");
    }
  }

  async function handleCancel() {
    if (!confirm("Cancel this redemption? Points will be refunded.")) return;
    setLoading(true);
    const result = await cancelRedemptionAction(redemptionId, fanId, pointCost);
    setLoading(false);
  }

  return (
    <div className="flex gap-2">
      {showNote ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="How was it fulfilled?"
            className="rounded-lg border border-white/10 bg-black/50 px-2 py-1 text-xs text-white placeholder-white/40 focus:border-white/30 focus:outline-none"
          />
          <button
            onClick={handleFulfill}
            disabled={loading}
            className="rounded-lg bg-green-500/20 px-3 py-1 text-xs font-medium text-green-300 hover:bg-green-500/30 disabled:opacity-50"
          >
            Done
          </button>
          <button
            onClick={() => setShowNote(false)}
            disabled={loading}
            className="rounded-lg border border-white/10 px-3 py-1 text-xs text-white/60 hover:bg-white/5 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      ) : (
        <>
          <button
            onClick={() => setShowNote(true)}
            disabled={loading}
            className="rounded-lg bg-green-500/20 px-3 py-1 text-xs font-medium text-green-300 hover:bg-green-500/30 disabled:opacity-50"
          >
            Fulfill
          </button>
          <button
            onClick={handleCancel}
            disabled={loading}
            className="rounded-lg bg-red-500/20 px-3 py-1 text-xs font-medium text-red-300 hover:bg-red-500/30 disabled:opacity-50"
          >
            Refund
          </button>
        </>
      )}
    </div>
  );
}
