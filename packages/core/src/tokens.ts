/**
 * Token counting facade. The real tokenizer lives behind the
 * `@pageskim/core/tokenizer` subpath so the main entry stays light enough to
 * bundle for browsers; conversion output NEVER depends on it (spec §9).
 */

export { budgetUnits, ESTIMATOR_LABEL } from "./text.js";

/**
 * All real token numbers PageSkim reports are estimates from one fixed
 * encoding, so they are comparable with each other but not exact for any
 * given model. Surface this label wherever counts are displayed.
 */
export const TOKENIZER_LABEL =
  "estimated (o200k_base); exact counts vary by model tokenizer";

export type TokenCounter = (text: string) => number;
