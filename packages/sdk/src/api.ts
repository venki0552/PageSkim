/**
 * The public PageSkim SDK surface. Framework-free, SSR-safe (no window or
 * document access at import time), identical conversion output to the CLI —
 * both call the same @pageskim/core convert().
 */

import {
  budgetUnits,
  convert,
  ESTIMATOR_LABEL,
  TOKENIZER_LABEL,
  type ConvertSuccess,
  type SiblingDoc,
  type TokenReport,
  type Warning,
} from "@pageskim/core";

export { SPEC_VERSION } from "@pageskim/core";
export type { SiblingDoc, TokenReport, Warning };

export class PageSkimError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "PageSkimError";
    this.code = code;
  }
}

export interface FromHtmlOptions {
  /** Canonical URL fallback for pages that do not declare one. */
  url?: string;
}

export interface PageSkimResult {
  llmMd: string;
  llmJson: string;
  /** Split-file layout: relative filename → content (spec §11). */
  splitFiles: Record<string, string>;
  tokenReport: TokenReport;
  warnings: Warning[];
  doc: SiblingDoc;
}

/* ------------------------------------------------------- tokenizer state */

type Counter = (text: string) => number;
let realCounter: Counter | null = null;

/** Register a real tokenizer (e.g. from @pageskim/core/tokenizer); null unregisters. */
export function registerTokenizer(counter: Counter | null): void {
  realCounter = counter;
}

/** True when a real tokenizer is registered (counts are o200k estimates). */
export function hasTokenizer(): boolean {
  return realCounter !== null;
}

/**
 * Load and register the real tokenizer (~a few MB of BPE ranks — lazy on
 * purpose). Bundlers code-split this; browser <script> users load
 * pageskim.tokenizer.min.js instead.
 */
export async function loadTokenizer(): Promise<void> {
  const mod = await import("@pageskim/core/tokenizer");
  registerTokenizer(mod.countTokens);
}

/**
 * Count tokens in a string. Uses the registered tokenizer when present,
 * otherwise the deterministic bytes/4 budget metric. See tokenBasis().
 */
export function tokenCount(text: string): number {
  return (realCounter ?? budgetUnits)(text);
}

/** Human-readable label describing what tokenCount() numbers mean. */
export function tokenBasis(): string {
  return realCounter ? TOKENIZER_LABEL : ESTIMATOR_LABEL;
}

/* ------------------------------------------------------------ conversion */

function toResult(r: ConvertSuccess): PageSkimResult {
  return {
    llmMd: r.md,
    llmJson: r.json,
    splitFiles: r.splitFiles,
    tokenReport: r.report,
    warnings: r.warnings,
    doc: r.doc,
  };
}

/** Convert an HTML string to its PageSkim sibling. Throws PageSkimError. */
export function fromHTML(html: string, opts: FromHtmlOptions = {}): PageSkimResult {
  const r = convert(html, { url: opts.url, countTokens: realCounter ?? undefined });
  if (!r.ok) throw new PageSkimError(r.error.code, r.error.message);
  return toResult(r);
}

/** Minimal structural type so SSR code can pass a non-lib.dom document. */
export interface DocumentLike {
  documentElement: { outerHTML: string };
  location?: { href: string };
}

/**
 * Convert the LIVE rendered DOM. This is the official answer for
 * client-rendered apps: call after hydration and the sibling reflects what
 * users actually see. Produces identical output to the CLI given equivalent
 * static HTML (same core pipeline).
 */
export function fromDocument(doc: DocumentLike, opts: FromHtmlOptions = {}): PageSkimResult {
  const html = `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`;
  return fromHTML(html, { url: opts.url ?? doc.location?.href });
}

/* --------------------------------------------------------------- savings */

export interface Savings {
  rawTokens: number;
  siblingTokens: number;
  headerTokens: number;
  savedPct: number;
  headerSavedPct: number;
  basis: string;
}

/** One-call token-savings summary for anyone who just wants the counter. */
export function savings(rawHtml: string, opts: FromHtmlOptions = {}): Savings {
  const { tokenReport } = fromHTML(rawHtml, opts);
  return {
    rawTokens: tokenReport.rawHtml,
    siblingTokens: tokenReport.sibling,
    headerTokens: tokenReport.headerOnly,
    savedPct: Math.round((1 - tokenReport.sibling / tokenReport.rawHtml) * 1000) / 10,
    headerSavedPct: Math.round((1 - tokenReport.headerOnly / tokenReport.rawHtml) * 1000) / 10,
    basis: tokenReport.basis,
  };
}

/* ---------------------------------------------------------------- expose */

/** Structural document type for expose(); satisfied by the real Document. */
export interface ExposableDocument {
  getElementById(id: string): { remove(): void } | null;
  createElement(tag: string): {
    setAttribute(name: string, value: string): void;
    textContent: string | null;
    remove(): void;
  };
  head: { appendChild(node: unknown): unknown };
  querySelector(sel: string): { remove(): void } | null;
}

/**
 * Inject the result into the page so crawlers and agents inspecting the DOM
 * can find it:
 *
 *   <script type="text/llm+markdown" id="pageskim">…</script>
 *   <link rel="alternate" type="text/llm+markdown" href="…">
 *
 * NOTE: static sibling FILES remain the preferred deployment — they are
 * cacheable and fetchable without executing JavaScript. Runtime exposure is
 * the fallback for SPAs that cannot pre-render.
 */
export function expose(
  result: PageSkimResult,
  doc: ExposableDocument,
  opts: { href?: string } = {},
): void {
  doc.getElementById("pageskim")?.remove();
  const script = doc.createElement("script");
  script.setAttribute("type", "text/llm+markdown");
  script.setAttribute("id", "pageskim");
  script.textContent = result.llmMd;
  doc.head.appendChild(script);

  doc.querySelector('link[rel="alternate"][type="text/llm+markdown"]')?.remove();
  const link = doc.createElement("link");
  link.setAttribute("rel", "alternate");
  link.setAttribute("type", "text/llm+markdown");
  link.setAttribute("href", opts.href ?? "#pageskim");
  doc.head.appendChild(link);
}
