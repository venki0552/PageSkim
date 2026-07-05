/**
 * Browser <script> entry → global `PageSkim`. Self-contained except the
 * tokenizer: token counts use the bytes/4 budget metric unless
 * pageskim.tokenizer.min.js is also loaded (either order works).
 */

import { registerTokenizer } from "./api.js";
import { definePageskimBadge } from "./badge.js";

export * from "./index.js";

// loadTokenizer() from the ESM entry relies on dynamic import, which a bare
// <script> cannot resolve — steer users to the addon file instead.
export async function loadTokenizer(): Promise<void> {
  throw new Error(
    "In <script> usage, load the tokenizer addon instead: " +
      '<script src="https://unpkg.com/pageskim/dist/pageskim.tokenizer.min.js"></script>',
  );
}

declare global {
  var __PAGESKIM_TOKENIZER__: ((text: string) => number) | undefined;
}

// The addon may have loaded before us and parked the counter.
if (typeof globalThis.__PAGESKIM_TOKENIZER__ === "function") {
  registerTokenizer(globalThis.__PAGESKIM_TOKENIZER__);
}

// Auto-define the badge element in browsers.
definePageskimBadge();
