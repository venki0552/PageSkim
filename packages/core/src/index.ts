/**
 * @agentpage/core — pure, isomorphic conversion library for the AgentPage format.
 *
 * Invariants (see CONTRIBUTING.md):
 * - Runs unmodified in Node and the browser/edge. No Node-only APIs, no
 *   framework dependencies, no network calls at runtime.
 * - Deterministic: same input → byte-identical output.
 *
 * The parse → extract → emit pipeline lands in Phase 2. Phase 0 ships the
 * token-counting utilities that every other layer (CLI, SDK, playground)
 * reports through.
 */

export { countTokens, TOKENIZER_LABEL, type TokenCount } from "./tokens.js";

/** Version of the AgentPage format spec this library targets (spec/SPEC.md). */
export const SPEC_VERSION = "0.1.0-dev";
