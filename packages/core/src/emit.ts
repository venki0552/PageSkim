/** Emitters: .md rendering (spec §5), .json rendering (§12), split (§11). */

import { budgetUnits, truncateAtWord } from "./text.js";
import type { SiblingDoc } from "./types.js";

export const HEADER_TARGET = 100;
export const HEADER_CAP = 150;
const GROUP_SIZE = 50;
const GROUPED_TOC_THRESHOLD = 100;
const TOC_DESC_MAX = 80;

function escapeCell(cell: string): string {
  return cell.replaceAll("\\", "\\\\").replaceAll("|", "\\|").replaceAll("\n", "\\n");
}

export function unescapeCell(cell: string): string {
  let out = "";
  for (let i = 0; i < cell.length; i++) {
    if (cell[i] === "\\" && i + 1 < cell.length) {
      const next = cell[i + 1];
      if (next === "\\") { out += "\\"; i += 1; continue; }
      if (next === "|") { out += "|"; i += 1; continue; }
      if (next === "n") { out += "\n"; i += 1; continue; }
    }
    out += cell[i];
  }
  return out;
}

type TocMode = "full" | "ids" | "grouped";

/** TOC description: first 6 words of the summary, ≤48 chars (spec §9). */
function tocDesc(summary: string): string {
  const sixWords = summary.split(" ").slice(0, 6).join(" ").replace(/[\s,;:.]+$/u, "");
  return truncateAtWord(sixWords, 48);
}

function tocLines(doc: SiblingDoc, mode: TocMode): string[] {
  if (mode === "grouped") {
    const lines: string[] = [];
    for (let g = 0; g * GROUP_SIZE < doc.toc.length; g++) {
      const slice = doc.toc.slice(g * GROUP_SIZE, (g + 1) * GROUP_SIZE);
      lines.push(
        `- toc-${g + 1}: ${slice[0]!.id} … ${slice[slice.length - 1]!.id} (${slice.length} chunks)`,
      );
    }
    return lines;
  }
  return doc.toc.map((t) => {
    if (mode === "ids" || t.summary === "") return `- ${t.id}`;
    return `- ${t.id}: ${tocDesc(t.summary)}`;
  });
}

function headerSection(doc: SiblingDoc, mode: TocMode): string {
  const meta: string[] = [`type: ${doc.type}`];
  if (doc.url) meta.push(`url: ${doc.url}`);
  if (doc.lang) meta.push(`lang: ${doc.lang}`);
  if (doc.updated) meta.push(`updated: ${doc.updated}`);
  if (doc.series.prev) meta.push(`series-prev: ${doc.series.prev}`);
  if (doc.series.next) meta.push(`series-next: ${doc.series.next}`);
  meta.push(`hash: ${doc.hash}`);
  return [
    `<!-- pageskim ${doc.pageskim} -->`,
    `# ${doc.title}`,
    "",
    `> ${doc.summary}`,
    "",
    meta.join("\n"),
    "",
    "## toc",
    ...tocLines(doc, mode),
  ].join("\n");
}

/** Pick the TOC mode per the spec §9 overflow sequence + §15 grouping. */
export function chooseTocMode(doc: SiblingDoc): TocMode {
  if (doc.toc.length > GROUPED_TOC_THRESHOLD) return "grouped";
  for (const mode of ["full", "ids"] as const) {
    if (budgetUnits(headerSection(doc, mode)) <= HEADER_CAP) return mode;
  }
  return "grouped";
}

export function emitHeader(doc: SiblingDoc): string {
  return headerSection(doc, chooseTocMode(doc));
}

function subTocSections(doc: SiblingDoc): string[] {
  if (chooseTocMode(doc) !== "grouped") return [];
  const sections: string[] = [];
  for (let g = 0; g * GROUP_SIZE < doc.toc.length; g++) {
    const slice = doc.toc.slice(g * GROUP_SIZE, (g + 1) * GROUP_SIZE);
    sections.push(
      [`## toc ${g + 1}`, ...slice.map((t) => (t.summary ? `- ${t.id}: ${truncateAtWord(t.summary, TOC_DESC_MAX)}` : `- ${t.id}`))].join("\n"),
    );
  }
  return sections;
}

export function emitFactsSection(doc: SiblingDoc): string {
  const lines: string[] = ["## facts"];
  for (const { key, value } of doc.facts.kv) {
    lines.push(`- ${key}: ${value.replaceAll("\n", "\\n")}`);
  }
  for (const table of doc.facts.tables) {
    lines.push(`@table ${table.id}`);
    lines.push(`cols: ${table.cols.map(escapeCell).join("|")}`);
    for (const row of table.rows) lines.push(row.map(escapeCell).join("|"));
    lines.push("@end");
  }
  return lines.join("\n");
}

export function emitChunkSection(doc: SiblingDoc, index: number): string {
  const chunk = doc.chunks[index]!;
  const head: string[] = [`## chunk ${chunk.id}`, `summary: ${chunk.summary}`];
  if (chunk.tags.length > 0) head.push(`tags: ${chunk.tags.join(", ")}`);
  head.push(`anchor: ${chunk.anchor ?? "none"}`);
  const body = chunk.text === "" ? "" : `\n\n${chunk.text}`;
  return head.join("\n") + body;
}

/** The combined `.llm.md` rendering. */
export function emitMd(doc: SiblingDoc): string {
  const sections = [
    emitHeader(doc),
    ...subTocSections(doc),
    emitFactsSection(doc),
    ...doc.chunks.map((_, i) => emitChunkSection(doc, i)),
  ];
  return `${sections.join("\n\n")}\n`;
}

/** The `.llm.json` rendering (canonical serialization, spec §12). */
export function emitJson(doc: SiblingDoc): string {
  const obj = {
    pageskim: doc.pageskim,
    title: doc.title,
    summary: doc.summary,
    type: doc.type,
    url: doc.url,
    lang: doc.lang,
    updated: doc.updated,
    series: doc.series,
    hash: doc.hash,
    toc: doc.toc,
    facts: doc.facts,
    chunks: doc.chunks,
  };
  return `${JSON.stringify(obj, null, 2)}\n`;
}

/** Split-file layout (spec §11): relative filename → content. */
export function emitSplit(doc: SiblingDoc): Record<string, string> {
  const files: Record<string, string> = {
    "_header.md": `${emitHeader(doc)}\n`,
    "facts.md": `${emitFactsSection(doc)}\n`,
  };
  subTocSections(doc).forEach((section, i) => {
    files[`_toc-${i + 1}.md`] = `${section}\n`;
  });
  doc.chunks.forEach((chunk, i) => {
    files[`${chunk.id}.md`] = `${emitChunkSection(doc, i)}\n`;
  });
  return files;
}
