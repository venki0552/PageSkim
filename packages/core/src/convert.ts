/** convert(): the full pipeline. Deterministic; isomorphic; no I/O. */

import { buildChunks } from "./chunk.js";
import { parseHtml } from "./dom.js";
import { emitFactsSection, emitHeader, emitJson, emitMd, emitSplit, HEADER_TARGET } from "./emit.js";
import { extract } from "./extract.js";
import { harvestFacts } from "./facts.js";
import { harvestMeta } from "./meta.js";
import { sha256Hex } from "./sha256.js";
import { budgetUnits, ESTIMATOR_LABEL, firstSentence, normalizeText, truncateAtWord } from "./text.js";
import type { ConvertOptions, ConvertResult, SiblingDoc, Warning } from "./types.js";

export const SPEC_MARKER_VERSION = "0.1";

const SPA_SCRIPT_THRESHOLD = 2000;
const THIN_TEXT_THRESHOLD = 200;

export function convert(html: string, opts: ConvertOptions = {}): ConvertResult {
  const warnings: Warning[] = [];

  let extraction;
  let doc;
  try {
    doc = parseHtml(html);
    extraction = extract(doc);
  } catch (err) {
    return {
      ok: false,
      error: { code: "PARSE_FAILURE", message: `HTML could not be processed: ${String(err)}` },
      warnings,
    };
  }

  const mainText = normalizeText(extraction.mainText);
  if (mainText.length < THIN_TEXT_THRESHOLD) {
    if (extraction.scriptChars > SPA_SCRIPT_THRESHOLD) {
      return {
        ok: false,
        error: {
          code: "EMPTY_EXTRACTION",
          message:
            "Extraction found almost no content but the page is script-heavy — " +
            "this looks like a client-rendered app. Pre-render it or supply the " +
            "rendered HTML (e.g. copy document.documentElement.outerHTML from the " +
            "browser console, or use the SDK's fromDocument() at runtime).",
        },
        warnings,
      };
    }
    warnings.push({
      code: "THIN_PAGE",
      message: "Very little content was extracted; emitting a minimal sibling.",
    });
  }

  const paragraphCount = extraction.blocks.filter((b) => b.kind === "para").length;
  const meta = harvestMeta(doc, { url: opts.url }, paragraphCount);
  const facts = harvestFacts(extraction, meta);
  const chunking = buildChunks(extraction.blocks, extraction.htmlIds, facts.tableIdByIndex);

  if (chunking.usedFallback) {
    warnings.push({
      code: "NO_HEADINGS",
      message: "No headings found; used paragraph-cluster chunking with generated IDs (anchor: none).",
    });
  }
  for (const chunk of chunking.chunks) {
    if (chunk.anchor === null) {
      warnings.push({
        code: "NO_ANCHOR",
        message: `Chunk "${chunk.id}" has no matching anchor in the HTML (anchor: none).`,
      });
    }
  }

  const introSummary = chunking.chunks.length > 0 ? chunking.chunks[0]!.summary : "";
  const summary =
    meta.summary ??
    (introSummary !== "" ? truncateAtWord(firstSentence(introSummary), 200) : meta.title);

  const sibling: SiblingDoc = {
    pageskim: SPEC_MARKER_VERSION,
    title: meta.title,
    summary,
    type: meta.type,
    url: meta.url,
    lang: meta.lang,
    updated: meta.updated,
    series: meta.series,
    hash: `sha256:${sha256Hex(mainText).slice(0, 16)}`,
    toc: chunking.chunks.map((c) => ({ id: c.id, summary: c.summary })),
    facts: { kv: facts.kv, tables: facts.tables },
    chunks: chunking.chunks,
  };

  const md = emitMd(sibling);
  const header = emitHeader(sibling);
  if (budgetUnits(header) > HEADER_TARGET) {
    warnings.push({
      code: "HEADER_OVER_TARGET",
      message: `Header is ${budgetUnits(header)} budget units (target ${HEADER_TARGET}, cap 150).`,
    });
  }

  const count = opts.countTokens ?? budgetUnits;
  const basis = opts.countTokens
    ? "estimated (o200k_base); exact counts vary by model tokenizer"
    : ESTIMATOR_LABEL;

  return {
    ok: true,
    doc: sibling,
    md,
    json: emitJson(sibling),
    splitFiles: emitSplit(sibling),
    report: {
      basis,
      rawHtml: count(html),
      sibling: count(md),
      headerOnly: count(header),
      facts: count(emitFactsSection(sibling)),
      chunks: sibling.chunks.map((c) => ({ id: c.id, tokens: count(c.text) })),
    },
    warnings,
  };
}
