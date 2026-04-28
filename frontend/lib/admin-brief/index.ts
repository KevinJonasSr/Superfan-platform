/**
 * Public surface of the admin-brief module.
 * Always import from "@/lib/admin-brief".
 */

export {
  gatherAdminBriefMetrics,
  type AdminBriefMetrics,
  type CommunityMetrics,
  type PlatformMetrics,
  type Anomaly,
} from "./gather";

export {
  summarizeAdminBrief,
  AdminBriefError,
  ADMIN_BRIEF_MODEL,
  ADMIN_BRIEF_PROMPT_VERSION,
} from "./summarize";

export {
  persistAndDispatchBrief,
  type SendBriefResult,
} from "./send";
