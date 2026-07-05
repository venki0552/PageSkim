/** Text utilities. All deterministic; all isomorphic. */

const encoder = new TextEncoder();

/** Spec §9: budget metric = ceil(utf8 bytes / 4). Tokenizer-independent. */
export function budgetUnits(text: string): number {
  return Math.ceil(encoder.encode(text).length / 4);
}

export const ESTIMATOR_LABEL =
  "approximate (bytes/4 heuristic); load the tokenizer module for o200k estimates";

/** Spec §10 step 2: NFC, collapse Unicode whitespace runs to one space, trim. */
export function normalizeText(text: string): string {
  return text.normalize("NFC").replace(/\s+/gu, " ").trim();
}

/** Collapse whitespace without trimming surrounding context decisions. */
export function collapseWs(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}

/** Truncate at a word boundary to at most `max` chars, appending … if cut. */
export function truncateAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > max * 0.5 ? slice.slice(0, lastSpace) : slice;
  return `${cut.replace(/[\s,;:]+$/u, "")}…`;
}

const SENTENCE_END = /(?<=[.!?…。．！？])\s+/u;

/** First sentence of a prose string; whole string if no boundary is found. */
export function firstSentence(text: string): string {
  const collapsed = collapseWs(text);
  const parts = collapsed.split(SENTENCE_END);
  return parts[0] ?? collapsed;
}

/** Split prose into sentences (used by the validator's grounding check). */
export function splitSentences(text: string): string[] {
  const collapsed = collapseWs(text);
  if (collapsed === "") return [];
  return collapsed.split(SENTENCE_END).filter((s) => s.length > 0);
}

/** Reduce an ISO-ish datetime to YYYY-MM-DD, or null if unrecognizable. */
export function toIsoDate(value: string): string | null {
  const m = /(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}
