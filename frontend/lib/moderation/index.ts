/**
 * Public surface of the moderation module.
 * Always import from "@/lib/moderation".
 */

export {
  classifyContent,
  ModerationError,
  MODERATION_MODEL,
  PROMPT_VERSION,
  CATEGORIES,
  type ModerationCategory,
  type ModerationResult,
  type ModerationContext,
} from "./client";

export {
  moderateRow,
  moderateRowAsync,
  applyAdminOverride,
  type ModerateSourceTable,
  type ModerateResult,
} from "./moderate-row";
