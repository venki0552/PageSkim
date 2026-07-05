/**
 * Tokenizer addon for <script> usage. Heavy on purpose (bundles the o200k
 * BPE ranks); load it only when exact-ish token counts matter. Order-
 * independent with pageskim.min.js.
 */

import { countTokens } from "@pageskim/core/tokenizer";

interface PageSkimGlobal {
  registerTokenizer?: (counter: (text: string) => number) => void;
}

const g = globalThis as { PageSkim?: PageSkimGlobal; __PAGESKIM_TOKENIZER__?: (t: string) => number };

if (g.PageSkim && typeof g.PageSkim.registerTokenizer === "function") {
  g.PageSkim.registerTokenizer(countTokens);
} else {
  // pageskim.min.js hasn't loaded yet; it picks this up at startup.
  g.__PAGESKIM_TOKENIZER__ = countTokens;
}
