/**
 * Public surface of the recommendations module.
 * Always import from "@/lib/recs".
 *
 * Today: per-fan reward recommendations (Phase 10).
 * Future: per-fan event recommendations, cross-community discovery feed
 *         (Phase 7 — held off until volume).
 */

export {
  recommendReward,
  reasonCopy,
  type RecommendedReward,
} from "./rewards";
