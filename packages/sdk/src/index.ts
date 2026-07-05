/**
 * @agentpage/sdk — framework-free browser entry point for AgentPage.
 *
 * Phase 4B delivers the full surface (fromHTML, fromDocument, savings,
 * expose, the <agentpage-badge> element) plus ESM/UMD bundles. Phase 0
 * re-exports the token utilities so the public counting API is stable from
 * the start, and so the SDK ↔ core wiring is exercised by tests.
 *
 * Must stay SSR-safe: no window/document access at import time.
 */

export { SPEC_VERSION, TOKENIZER_LABEL } from "@agentpage/core";
import { countTokens } from "@agentpage/core";

/** Count tokens in a string. Estimated (o200k_base); varies by model. */
export function tokenCount(text: string): number {
  return countTokens(text);
}
