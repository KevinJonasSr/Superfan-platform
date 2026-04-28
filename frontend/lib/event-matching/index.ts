/**
 * Public surface of the event-matching module.
 * Always import from "@/lib/event-matching".
 */

export {
  scoreFan,
  scoreGeo,
  scoreTier,
  SCORE_WEIGHTS,
  CANDIDATE_TOP_PERCENT,
  CANDIDATE_MIN_SCORE,
  type ScoreInput,
  type ScoreComponents,
} from "./score";

export {
  matchEvent,
  type MatchedFan,
  type MatchEventResult,
} from "./match-event";

// Phase 8.4 will add:
//   export { sendEventMatchNotifications } from "./send";
