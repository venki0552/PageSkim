/** Sibling validation per spec §14.3 — the checks behind pageskim validate. */

import { attr, children, findAll, isElement, isText, parseHtml, rawText, tag, type AnyNode } from "./dom.js";
import { HEADER_CAP, HEADER_TARGET } from "./emit.js";
import { extract } from "./extract.js";
import { parseSibling, type ParsedSibling } from "./sibling.js";
import { sha256Hex } from "./sha256.js";
import { budgetUnits, normalizeText, splitSentences } from "./text.js";

export interface Finding {
  level: "error" | "warning";
  code:
    | "STRUCTURE"
    | "VERSION_UNSUPPORTED"
    | "TOC_CHUNK_MISMATCH"
    | "HASH_STALE"
    | "ANCHOR_BROKEN"
    | "ANCHOR_NONE"
    | "HEADER_OVER_CAP"
    | "HEADER_OVER_TARGET"
    | "FACTS_MALFORMED"
    | "DIVERGENT_CONTENT"
    | "DIVERGENT_FUZZY"
    | "NAV_LEAK";
  message: string;
}

export interface ValidationResult {
  findings: Finding[];
  errors: number;
  warnings: number;
  parsed: ParsedSibling;
}

/* -------------------------------------------------------------- corpora */

const INVISIBLE = new Set(["script", "style", "noscript", "template", "iframe", "head", "title", "svg"]);

function visibleTextOf(doc: AnyNode): string {
  let out = "";
  const visit = (n: AnyNode): void => {
    if (isElement(n)) {
      if (INVISIBLE.has(tag(n))) return;
      if (attr(n, "aria-hidden") === "true" || attr(n, "hidden") !== undefined) return;
    }
    if (isText(n)) out += `${n.data} `;
    for (const c of children(n)) visit(c);
  };
  visit(doc);
  return out;
}

/** Attribute/metadata text that facts may legitimately derive from. */
function metaCorpusOf(doc: AnyNode): string {
  const parts: string[] = [];
  for (const el of findAll(doc, () => true)) {
    for (const a of ["content", "alt", "datetime", "title", "value"]) {
      const v = attr(el, a);
      if (v) parts.push(v);
    }
    if (tag(el) === "script" && (attr(el, "type") ?? "").includes("ld+json")) {
      parts.push(rawText(el).replace(/["{}[\]]/g, " "));
    }
    if (tag(el) === "title" || tag(el) === "caption") parts.push(rawText(el));
  }
  return parts.join(" ");
}

/** Canonical matching form: normalized, backticks gone, punct spacing folded. */
function canon(text: string): string {
  return normalizeText(text.replaceAll("`", ""))
    .replace(/\s+([)\].,;:!?])/gu, "$1")
    .replace(/([([])\s+/gu, "$1")
    .toLowerCase();
}

function shingles(words: string[], n: number): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i + n <= words.length; i++) out.add(words.slice(i, i + n).join(" "));
  return out;
}

/* ------------------------------------------------------------ validation */

export interface ValidateOptions {
  /** Sentences shorter than this many characters are skipped. */
  minSentenceLength?: number;
}

export function validateSibling(html: string, md: string, opts: ValidateOptions = {}): ValidationResult {
  const minLen = opts.minSentenceLength ?? 15;
  const findings: Finding[] = [];
  const parsed = parseSibling(md);

  for (const e of parsed.errors) {
    findings.push({ level: "error", code: "STRUCTURE", message: `line ${e.line}: ${e.message}` });
  }
  if (parsed.version && parsed.version.major !== 0) {
    findings.push({
      level: "error",
      code: "VERSION_UNSUPPORTED",
      message: `spec major version ${parsed.version.major} is not supported by this validator`,
    });
  }

  const doc = parseHtml(html);
  const extraction = extract(doc);

  // TOC ↔ chunks.
  const tocIds = parsed.toc.map((t) => t.id);
  const chunkIds = parsed.chunks.map((c) => c.id);
  if (JSON.stringify(tocIds) !== JSON.stringify(chunkIds)) {
    findings.push({
      level: "error",
      code: "TOC_CHUNK_MISMATCH",
      message: `toc lists [${tocIds.join(", ")}] but chunk sections are [${chunkIds.join(", ")}]`,
    });
  }

  // Hash.
  const expectedHash = `sha256:${sha256Hex(normalizeText(extraction.mainText)).slice(0, 16)}`;
  if (parsed.meta["hash"] && parsed.meta["hash"] !== expectedHash) {
    findings.push({
      level: "error",
      code: "HASH_STALE",
      message: `hash ${parsed.meta["hash"]} does not match recomputed ${expectedHash} — sibling is stale`,
    });
  }

  // Anchors.
  for (const chunk of parsed.chunks) {
    if (chunk.anchor === null) {
      if (chunk.anchorDeclared) {
        findings.push({
          level: "warning",
          code: "ANCHOR_NONE",
          message: `chunk ${chunk.id}: anchor: none (no matching anchor in the HTML)`,
        });
      }
    } else if (!extraction.htmlIds.has(chunk.anchor.replace(/^#/, ""))) {
      findings.push({
        level: "error",
        code: "ANCHOR_BROKEN",
        message: `chunk ${chunk.id}: anchor ${chunk.anchor} not present in the HTML`,
      });
    }
  }

  // Header budget.
  if (parsed.headerText !== "") {
    const units = budgetUnits(parsed.headerText);
    if (units > HEADER_CAP) {
      findings.push({
        level: "error",
        code: "HEADER_OVER_CAP",
        message: `header is ${units} budget units (cap ${HEADER_CAP})`,
      });
    } else if (units > HEADER_TARGET) {
      findings.push({
        level: "warning",
        code: "HEADER_OVER_TARGET",
        message: `header is ${units} budget units (target ${HEADER_TARGET})`,
      });
    }
  }

  // Facts wellformedness.
  for (const table of parsed.factsTables) {
    for (const lineNo of table.malformedRows) {
      findings.push({
        level: "error",
        code: "FACTS_MALFORMED",
        message: `@table ${table.id}: row at line ${lineNo} has wrong cell count (expected ${table.cols.length})`,
      });
    }
  }
  for (const kv of parsed.factsKv) {
    if (kv.key.trim() === "" || kv.key.length > 64) {
      findings.push({
        level: "error",
        code: "FACTS_MALFORMED",
        message: `facts line ${kv.line}: bad key "${kv.key.slice(0, 30)}"`,
      });
    }
  }

  // Grounding / divergence / nav-leak.
  const visible = canon(visibleTextOf(doc));
  const mainCanon = canon(extraction.mainText);
  const metaCorpus = canon(metaCorpusOf(doc));
  const visibleShingles = shingles(visible.split(" "), 4);

  const checkSentence = (raw: string, where: string, allowMeta: boolean): void => {
    if (/^See table: /.test(raw)) return; // generator scaffolding (spec §14.1)
    let s = canon(raw.replace(/^figure: /, "").replace(/^> /, "").replace(/^#+ /, "").replace(/^- /, ""));
    s = s.replace(/…$/u, "").trim();
    if (s.length < minLen) return;
    if (visible.includes(s)) {
      if (!mainCanon.includes(s)) {
        findings.push({
          level: "warning",
          code: "NAV_LEAK",
          message: `${where}: grounded only in boilerplate, not main content: "${raw.slice(0, 60)}…"`,
        });
      }
      return;
    }
    if (allowMeta && metaCorpus.includes(s)) return;
    // Fuzzy: 4-word shingle containment.
    const words = s.split(" ");
    if (words.length >= 4) {
      const sh = shingles(words, 4);
      let hit = 0;
      for (const g of sh) if (visibleShingles.has(g)) hit += 1;
      if (hit / sh.size >= 0.6) {
        findings.push({
          level: "warning",
          code: "DIVERGENT_FUZZY",
          message: `${where}: only fuzzily grounded in the HTML: "${raw.slice(0, 60)}…"`,
        });
        return;
      }
    }
    findings.push({
      level: "error",
      code: "DIVERGENT_CONTENT",
      message: `${where}: not derivable from the page HTML (possible cloaking or injection): "${raw.slice(0, 80)}"`,
    });
  };

  if (parsed.title) checkSentence(parsed.title, "title", true);
  for (const s of splitSentences(parsed.summary ?? "")) checkSentence(s, "summary", true);

  for (const chunk of parsed.chunks) {
    // Sentence-by-sentence so an injected instruction cannot hide behind an
    // otherwise-grounded summary.
    for (const s of splitSentences(chunk.summary ?? "")) {
      checkSentence(s, `chunk ${chunk.id} summary`, false);
    }
    let inCode = false;
    const codeBuf: string[] = [];
    for (const line of chunk.text.split("\n")) {
      if (line.startsWith("```")) {
        if (inCode) {
          checkSentence(codeBuf.join(" "), `chunk ${chunk.id} code`, false);
          codeBuf.length = 0;
        }
        inCode = !inCode;
        continue;
      }
      if (inCode) {
        codeBuf.push(line);
        continue;
      }
      if (line === "" || line.startsWith("table: ")) continue;
      if (line.startsWith("figure: ")) {
        // Alt and caption may live in attributes → meta corpus allowed.
        for (const part of line.slice(8).split(" — ")) {
          checkSentence(part, `chunk ${chunk.id} figure`, true);
        }
        continue;
      }
      for (const sentence of splitSentences(line)) {
        checkSentence(sentence, `chunk ${chunk.id}`, false);
      }
    }
  }

  for (const kv of parsed.factsKv) {
    checkSentence(kv.value, `fact ${kv.key}`, true);
  }
  for (const table of parsed.factsTables) {
    for (const row of table.rows) {
      for (const cell of row) checkSentence(cell, `table ${table.id}`, true);
    }
  }

  return {
    findings,
    errors: findings.filter((f) => f.level === "error").length,
    warnings: findings.filter((f) => f.level === "warning").length,
    parsed,
  };
}
