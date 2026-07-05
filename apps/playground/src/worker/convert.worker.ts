/// <reference lib="webworker" />
/**
 * Paste-mode conversions run here so the UI thread never blocks. Loads the
 * real tokenizer lazily (few-MB chunk) so token math matches the CLI exactly;
 * falls back to the labeled estimator if that chunk fails to load.
 */

import { convert } from "@pageskim/core";
import type { ConvertRequest, ConvertResponse } from "./protocol";

let tokenizer: ((text: string) => number) | null | undefined;

async function getTokenizer(): Promise<((text: string) => number) | null> {
  if (tokenizer !== undefined) return tokenizer;
  try {
    const mod = await import("@pageskim/core/tokenizer");
    tokenizer = mod.countTokens;
  } catch {
    tokenizer = null;
  }
  return tokenizer;
}

self.onmessage = async (event: MessageEvent<ConvertRequest>) => {
  const { html } = event.data;
  const countTokens = await getTokenizer();
  const result = convert(html, { countTokens: countTokens ?? undefined });
  const response: ConvertResponse = result.ok
    ? {
        kind: "result",
        payload: {
          llmMd: result.md,
          llmJson: result.json,
          splitFiles: result.splitFiles,
          tokenReport: result.report,
          warnings: result.warnings,
          doc: result.doc,
        },
      }
    : { kind: "error", code: result.error.code, message: result.error.message };
  self.postMessage(response);
};
