/**
 * Public surface of the tagging module.
 * Always import from "@/lib/tagging".
 */

export {
  classifyTags,
  TagError,
  TAG_MODEL,
  TAG_PROMPT_VERSION,
  CANONICAL_TAGS,
  type CanonicalTag,
  type TagInput,
} from "./client";

export { tagRow, tagRowAsync, type TagRowResult } from "./tag-row";
