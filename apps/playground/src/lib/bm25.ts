/**
 * BM25-lite chunk scorer for the two-hop simulator. Client-side, no LLM:
 * given a question, rank chunks by lexical relevance over summary+tags+text.
 */

import type { SiblingDoc } from "@pageskim/core";

const K1 = 1.4;
const B = 0.75;

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((t) => t.length > 1);
}

export interface ScoredChunk {
  id: string;
  score: number;
}

export function rankChunks(doc: SiblingDoc, question: string): ScoredChunk[] {
  const query = [...new Set(tokenize(question))];
  const docs = doc.chunks.map((c) => ({
    id: c.id,
    // Summary and tags weighted by repetition — they are the header signal.
    tokens: tokenize(`${c.summary} ${c.summary} ${c.tags.join(" ")} ${c.tags.join(" ")} ${c.text}`),
  }));
  const avgLen = docs.reduce((s, d) => s + d.tokens.length, 0) / Math.max(docs.length, 1);
  const n = docs.length;

  const df = new Map<string, number>();
  for (const term of query) {
    df.set(term, docs.filter((d) => d.tokens.includes(term)).length);
  }

  return docs
    .map((d) => {
      let score = 0;
      for (const term of query) {
        const tf = d.tokens.filter((t) => t === term).length;
        if (tf === 0) continue;
        const idf = Math.log(1 + (n - df.get(term)! + 0.5) / (df.get(term)! + 0.5));
        score += (idf * tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * d.tokens.length) / avgLen));
      }
      return { id: d.id, score };
    })
    .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
}

/** Chunks an agent would fetch on hop 2: positive scores, max 3, at least 1. */
export function selectChunks(ranked: ScoredChunk[]): string[] {
  const positive = ranked.filter((r) => r.score > 0).slice(0, 3);
  if (positive.length > 0) return positive.map((r) => r.id);
  return ranked.slice(0, 1).map((r) => r.id);
}
