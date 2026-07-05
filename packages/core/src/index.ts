/**
 * @pageskim/core — pure, isomorphic conversion library for the PageSkim
 * format (spec v0.1).
 *
 * Invariants (see CONTRIBUTING.md):
 * - Runs unmodified in Node and the browser/edge. No Node-only APIs, no
 *   framework dependencies, no network calls at runtime.
 * - Deterministic: same input → byte-identical output, independent of
 *   whether a real tokenizer is present (spec §9).
 *
 * The heavy tokenizer is at `@pageskim/core/tokenizer` (separate subpath).
 */

export { convert, SPEC_MARKER_VERSION } from "./convert.js";
export {
  emitFactsSection,
  emitHeader,
  emitJson,
  emitMd,
  emitSplit,
  HEADER_CAP,
  HEADER_TARGET,
  unescapeCell,
} from "./emit.js";
export { emitSiteIndex, type SiteIndexEntry } from "./siteindex.js";
export { parseSibling, type ParsedSibling, type ParsedChunk } from "./sibling.js";
export { validateSibling, type Finding, type ValidationResult } from "./validate.js";
export { sha256Hex } from "./sha256.js";
export { isValidId, slugify, SlugDeduper } from "./slug.js";
export {
  budgetUnits,
  collapseWs,
  ESTIMATOR_LABEL,
  firstSentence,
  normalizeText,
  splitSentences,
  toIsoDate,
  truncateAtWord,
} from "./text.js";
export { TOKENIZER_LABEL, type TokenCounter } from "./tokens.js";
export type {
  Chunk,
  ConvertFailure,
  ConvertOptions,
  ConvertResult,
  ConvertSuccess,
  FactKv,
  FactTable,
  PageType,
  SiblingDoc,
  TokenReport,
  Warning,
} from "./types.js";

/** Version of the PageSkim format spec this library targets (spec/SPEC.md). */
export const SPEC_VERSION = "0.1.0";
