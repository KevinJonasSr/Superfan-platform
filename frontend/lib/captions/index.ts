/**
 * Public surface of the caption-suggestion module.
 * Always import from "@/lib/captions".
 */

export {
  suggestCaptions,
  CaptionError,
  CAPTION_MODEL,
  CAPTION_PROMPT_VERSION,
  type SuggestCaptionsInput,
} from "./client";
