/**
 * Public surface of the drafts module.
 * Always import from "@/lib/drafts".
 */

export {
  generateCommentDrafts,
  DraftError,
  DRAFT_MODEL,
  DRAFT_PROMPT_VERSION,
  type DraftCommentInput,
} from "./client";

export {
  draftComment,
  type DraftCommentRequest,
  type DraftCommentResult,
} from "./draft-comment";
