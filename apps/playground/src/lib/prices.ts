/**
 * Model input prices for the $-saved estimate. EDIT HERE when prices change,
 * and update PRICES_AS_OF. Input pricing only — the playground estimates what
 * you save by *sending* fewer tokens.
 */

export const PRICES_AS_OF = "2026-07-05";

export interface ModelPrice {
  id: string;
  label: string;
  /** USD per 1M input tokens. */
  inputPerMTok: number;
}

export const MODEL_PRICES: ModelPrice[] = [
  { id: "claude-opus-4-8", label: "Claude Opus 4.8", inputPerMTok: 5.0 },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5", inputPerMTok: 3.0 },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", inputPerMTok: 1.0 },
];

/** $ saved per 1,000 requests when each request sends `savedTokens` fewer tokens. */
export function dollarsSavedPer1k(savedTokens: number, inputPerMTok: number): number {
  return (savedTokens * 1000 * inputPerMTok) / 1_000_000;
}
