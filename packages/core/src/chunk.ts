/** Chunking per spec §7.1: h2 boundaries, oversize splitting, fallbacks. */

import type { Block } from "./extract.js";
import { SlugDeduper, isValidId, slugify } from "./slug.js";
import { budgetUnits, firstSentence, truncateAtWord } from "./text.js";
import type { Chunk } from "./types.js";

const OVERSIZE_LIMIT = 1200;
const FALLBACK_LIMIT = 500;
const SUMMARY_MAX = 160;

interface ProtoChunk {
  headingText: string | null;
  headingId: string | null;
  blocks: Block[];
}

function renderBlocks(blocks: Block[], boundary: number, tableIds: Map<number, string>): string {
  const parts: string[] = [];
  for (const b of blocks) {
    switch (b.kind) {
      case "heading":
        parts.push(`${"#".repeat(Math.min(b.level + (3 - boundary), 6))} ${b.text}`);
        break;
      case "para":
      case "list":
      case "quote":
      case "figure":
        parts.push(b.text);
        break;
      case "code":
        parts.push(`\`\`\`${b.lang ?? ""}\n${b.text}\n\`\`\``);
        break;
      case "tableref": {
        const id = tableIds.get(b.ref);
        if (id) parts.push(`table: ${id}`);
        break;
      }
    }
  }
  return parts.join("\n\n");
}

const SUMMARY_MIN_SENTENCE = 50;

function chunkSummary(blocks: Block[], tableIds: Map<number, string>): string {
  // Prefer the first paragraph whose opening sentence is substantial; stub
  // openers (hatnotes, labels) make useless summaries.
  let fallback: string | null = null;
  for (const b of blocks) {
    if (b.kind === "para" || b.kind === "quote") {
      const sentence = firstSentence(b.text.replace(/^> /, ""));
      if (fallback === null) fallback = sentence;
      if (sentence.length >= SUMMARY_MIN_SENTENCE) {
        return truncateAtWord(sentence, SUMMARY_MAX);
      }
    }
  }
  if (fallback !== null) return truncateAtWord(fallback, SUMMARY_MAX);
  for (const b of blocks) {
    if (b.kind === "list") {
      const first = b.text.split("\n")[0]!.replace(/^\s*- /, "");
      return truncateAtWord(firstSentence(first), SUMMARY_MAX);
    }
  }
  for (const b of blocks) {
    if (b.kind === "figure") return truncateAtWord(b.text.replace(/^figure: /, ""), SUMMARY_MAX);
    if (b.kind === "code") return truncateAtWord(b.text.split("\n")[0] ?? "", SUMMARY_MAX);
    if (b.kind === "tableref") {
      const id = tableIds.get(b.ref);
      if (id) return `See table: ${id}`;
    }
  }
  return "";
}

const CAP_PHRASE = /\p{Lu}[\p{L}\p{N}'’-]*(?:\s+\p{Lu}[\p{L}\p{N}'’-]*)+/gu;

function extractTags(text: string, headingText: string | null): string[] {
  const counts = new Map<string, { n: number; first: number }>();
  let m: RegExpExecArray | null;
  CAP_PHRASE.lastIndex = 0;
  while ((m = CAP_PHRASE.exec(text)) !== null) {
    // Sentence-initial articles are noise: "The Lighthouse" → "Lighthouse".
    const phrase = m[0].replace(/^(?:The|A|An)\s+/u, "");
    if (!/\s/.test(phrase)) continue; // single word left after stripping
    if (headingText && phrase === headingText) continue;
    if (phrase.length > 48) continue;
    const cur = counts.get(phrase);
    if (cur) cur.n += 1;
    else counts.set(phrase, { n: 1, first: m.index });
  }
  const ranked = [...counts.entries()].sort(
    (a, b) => b[1].n - a[1].n || a[1].first - b[1].first,
  );
  const tags: string[] = [];
  for (const [phrase] of ranked) {
    const slug = slugify(phrase);
    if (!tags.includes(slug)) tags.push(slug);
    if (tags.length === 4) break;
  }
  return tags;
}

export interface ChunkingResult {
  chunks: Chunk[];
  /** True when the no-headings paragraph-cluster fallback was used. */
  usedFallback: boolean;
  /** id of the page h1, if any (used as the intro anchor). */
  titleAnchor: string | null;
}

export function buildChunks(
  allBlocks: Block[],
  htmlIds: Set<string>,
  tableIds: Map<number, string>,
): ChunkingResult {
  // Drop the leading h1 (it is the page title), remember its id.
  const blocks = [...allBlocks];
  let titleAnchor: string | null = null;
  const h1Index = blocks.findIndex((b) => b.kind === "heading" && b.level === 1);
  if (h1Index !== -1) {
    const h1 = blocks[h1Index] as Extract<Block, { kind: "heading" }>;
    titleAnchor = h1.id;
    blocks.splice(h1Index, 1);
  }

  const levels = new Set(
    blocks.filter((b): b is Extract<Block, { kind: "heading" }> => b.kind === "heading").map((b) => b.level),
  );
  const boundary = levels.has(2) ? 2 : levels.has(3) ? 3 : levels.has(4) ? 4 : null;

  if (boundary === null) {
    return { chunks: fallbackChunks(blocks, tableIds), usedFallback: blocks.length > 0, titleAnchor };
  }

  // Group blocks into proto-chunks at boundary headings.
  const protos: ProtoChunk[] = [];
  let current: ProtoChunk = { headingText: null, headingId: titleAnchor, blocks: [] };
  for (const b of blocks) {
    if (b.kind === "heading" && b.level === boundary) {
      protos.push(current);
      current = { headingText: b.text, headingId: b.id, blocks: [] };
    } else {
      current.blocks.push(b);
    }
  }
  protos.push(current);

  // Oversize splitting at sub-boundary headings.
  const expanded: ProtoChunk[] = [];
  for (const proto of protos) {
    const rendered = renderBlocks(proto.blocks, boundary, tableIds);
    const hasSub = proto.blocks.some((b) => b.kind === "heading" && b.level === boundary + 1);
    if (budgetUnits(rendered) > OVERSIZE_LIMIT && hasSub) {
      let part: ProtoChunk = { ...proto, blocks: [] };
      for (const b of proto.blocks) {
        if (b.kind === "heading" && b.level === boundary + 1) {
          expanded.push(part);
          part = { headingText: b.text, headingId: b.id, blocks: [] };
        } else {
          part.blocks.push(b);
        }
      }
      expanded.push(part);
    } else {
      expanded.push(proto);
    }
  }

  const deduper = new SlugDeduper();
  const chunks: Chunk[] = [];
  expanded.forEach((proto, i) => {
    const isIntro = i === 0 && proto.headingText === null;
    if (proto.blocks.length === 0 && isIntro) return; // empty intro omitted
    if (proto.blocks.length === 0 && proto.headingText === null) return;

    const id = isIntro
      ? deduper.claimExact("intro")
      : proto.headingId && isValidId(proto.headingId)
        ? deduper.claim(proto.headingId)
        : deduper.claim(slugify(proto.headingText ?? "section"));

    const anchorId = isIntro ? titleAnchor : proto.headingId;
    const text = renderBlocks(proto.blocks, boundary, tableIds);
    chunks.push({
      id,
      summary: chunkSummary(proto.blocks, tableIds) || (proto.headingText ?? ""),
      tags: extractTags(text, proto.headingText),
      anchor: anchorId && htmlIds.has(anchorId) ? `#${anchorId}` : null,
      text,
    });
  });

  return { chunks, usedFallback: false, titleAnchor };
}

function fallbackChunks(blocks: Block[], tableIds: Map<number, string>): Chunk[] {
  const chunks: Chunk[] = [];
  let buf: Block[] = [];
  let size = 0;
  const flush = (): void => {
    if (buf.length === 0) return;
    const text = renderBlocks(buf, 2, tableIds);
    chunks.push({
      id: `part-${chunks.length + 1}`,
      summary: chunkSummary(buf, tableIds),
      tags: extractTags(text, null),
      anchor: null,
      text,
    });
    buf = [];
    size = 0;
  };
  for (const b of blocks) {
    const rendered = renderBlocks([b], 2, tableIds);
    const units = budgetUnits(rendered);
    if (size > 0 && size + units > FALLBACK_LIMIT) flush();
    buf.push(b);
    size += units;
  }
  flush();
  return chunks;
}
