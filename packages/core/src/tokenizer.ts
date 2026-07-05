/**
 * Real tokenizer (o200k_base via gpt-tokenizer). Import from
 * `@pageskim/core/tokenizer`. Kept out of the main entry because the BPE
 * ranks are megabytes — browser bundles load this lazily or not at all.
 */

import { countTokens as o200kCount } from "gpt-tokenizer/encoding/o200k_base";

export { TOKENIZER_LABEL } from "./tokens.js";

/** Count tokens using the o200k_base encoding. Deterministic. */
export function countTokens(text: string): number {
  if (text.length === 0) return 0;
  return o200kCount(text);
}
