/** Shared types for the PageSkim conversion pipeline (spec v0.1). */

export type PageType = "article" | "docs" | "product" | "blog" | "reference" | "other";

export interface FactKv {
  key: string;
  value: string;
}

export interface FactTable {
  id: string;
  cols: string[];
  rows: string[][];
}

export interface Chunk {
  id: string;
  summary: string;
  tags: string[];
  /** Fragment including leading '#', or null (= `anchor: none`). */
  anchor: string | null;
  text: string;
}

/** The parsed/derived sibling document — the structure both renderings share. */
export interface SiblingDoc {
  pageskim: string;
  title: string;
  summary: string;
  type: PageType;
  url: string | null;
  lang: string | null;
  updated: string | null;
  series: { prev: string | null; next: string | null };
  hash: string;
  toc: { id: string; summary: string }[];
  facts: { kv: FactKv[]; tables: FactTable[] };
  chunks: Chunk[];
}

export interface Warning {
  code: string;
  message: string;
}

export interface TokenReport {
  /** What the numbers mean, e.g. the TOKENIZER_LABEL or the estimator label. */
  basis: string;
  rawHtml: number;
  sibling: number;
  headerOnly: number;
  facts: number;
  chunks: { id: string; tokens: number }[];
}

export interface ConvertOptions {
  /** Canonical URL override / fallback when the page declares none. */
  url?: string;
  /**
   * Real tokenizer for the token report. When omitted, the deterministic
   * budget-metric estimator is used and the report's basis says so.
   * NEVER affects emitted content (spec §9).
   */
  countTokens?: (text: string) => number;
}

export interface ConvertSuccess {
  ok: true;
  doc: SiblingDoc;
  md: string;
  json: string;
  /** Relative filename → content, per spec §11 (includes `_header.md` etc.). */
  splitFiles: Record<string, string>;
  report: TokenReport;
  warnings: Warning[];
}

export interface ConvertFailure {
  ok: false;
  error: { code: "EMPTY_EXTRACTION" | "PARSE_FAILURE"; message: string };
  warnings: Warning[];
}

export type ConvertResult = ConvertSuccess | ConvertFailure;
