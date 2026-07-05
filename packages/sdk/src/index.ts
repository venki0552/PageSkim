/**
 * pageskim — make any web page readable by LLMs and agents at 10-50x fewer
 * tokens. ESM entry point (bundlers/Node). For plain <script> use, see
 * dist/pageskim.min.js (global `PageSkim`).
 *
 * SSR-safe: importing this module touches no browser globals.
 */

export {
  expose,
  fromDocument,
  fromHTML,
  hasTokenizer,
  loadTokenizer,
  PageSkimError,
  registerTokenizer,
  savings,
  SPEC_VERSION,
  tokenBasis,
  tokenCount,
  type DocumentLike,
  type ExposableDocument,
  type FromHtmlOptions,
  type PageSkimResult,
  type Savings,
  type SiblingDoc,
  type TokenReport,
  type Warning,
} from "./api.js";

export { definePageskimBadge } from "./badge.js";
