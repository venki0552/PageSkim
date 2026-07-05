/**
 * @pageskim/sdk — framework-free browser entry point for PageSkim.
 *
 * Phase 4B delivers the full surface (fromHTML, fromDocument, savings,
 * expose, the <pageskim-badge> element) plus ESM/UMD bundles.
 *
 * Must stay SSR-safe: no window/document access at import time.
 */

export { SPEC_VERSION, TOKENIZER_LABEL, budgetUnits } from "@pageskim/core";

import { budgetUnits } from "@pageskim/core";

/**
 * Count tokens in a string. Uses the budget-metric estimate unless a real
 * tokenizer has been registered (Phase 4B adds registerTokenizer()).
 */
export function tokenCount(text: string): number {
  return budgetUnits(text);
}
