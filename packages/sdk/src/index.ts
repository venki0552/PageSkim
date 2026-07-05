/**
 * @pageskim/sdk — framework-free browser entry point for PageSkim.
 *
 * Phase 4B delivers the full surface (fromHTML, fromDocument, savings,
 * expose, the <pageskim-badge> element) plus ESM/UMD bundles. Phase 0
 * re-exports the token utilities so the public counting API is stable from
 * the start, and so the SDK ↔ core wiring is exercised by tests.
 *
 * Must stay SSR-safe: no window/document access at import time.
 */

export { SPEC_VERSION, TOKENIZER_LABEL } from "@pageskim/core";
import { countTokens } from "@pageskim/core";

/** Count tokens in a string. Estimated (o200k_base); varies by model. */
export function tokenCount(text: string): number {
  return countTokens(text);
}
