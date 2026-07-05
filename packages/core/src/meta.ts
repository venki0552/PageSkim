/** Page metadata harvest per spec §8.5. */

import {
  type Document,
  attr,
  collapseInline,
  findAll,
  findFirst,
  linkHref,
  metaContent,
  rawText,
  tag,
} from "./dom.js";
import { isStripped } from "./extract.js";
import { collapseWs, toIsoDate, truncateAtWord } from "./text.js";
import type { PageType } from "./types.js";

export interface PageMeta {
  title: string;
  /** Meta-sourced summary; null means "derive from intro chunk". */
  summary: string | null;
  type: PageType;
  url: string | null;
  lang: string | null;
  updated: string | null;
  series: { prev: string | null; next: string | null };
  /** Parsed JSON-LD roots, document order (for facts + type detection). */
  jsonLd: unknown[];
  author: string | null;
  published: string | null;
  modified: string | null;
}

function parseJsonLd(doc: Document): unknown[] {
  const out: unknown[] = [];
  for (const el of findAll(doc, (e) => tag(e) === "script")) {
    if ((attr(el, "type") ?? "").toLowerCase() !== "application/ld+json") continue;
    try {
      const parsed: unknown = JSON.parse(rawText(el));
      if (Array.isArray(parsed)) out.push(...parsed);
      else if (parsed !== null && typeof parsed === "object") out.push(parsed);
    } catch {
      // Malformed JSON-LD is ignored (warning added by convert()).
      out.push(undefined);
    }
  }
  return out;
}

function jsonLdType(roots: unknown[]): string | null {
  for (const root of roots) {
    if (root && typeof root === "object" && "@type" in root) {
      const t = (root as Record<string, unknown>)["@type"];
      if (typeof t === "string") return t;
      if (Array.isArray(t) && typeof t[0] === "string") return t[0];
    }
  }
  return null;
}

function detectType(doc: Document, url: string | null, roots: unknown[], paragraphCount: number): PageType {
  const ld = jsonLdType(roots);
  if (ld === "Product") return "product";
  if (ld === "BlogPosting") return "blog";
  if (ld === "Article" || ld === "NewsArticle") return "article";
  if (ld === "TechArticle") return "docs";

  const ogType = metaContent(doc, "og:type")?.toLowerCase() ?? null;
  if (ogType === "product") return "product";
  if (ogType === "article") {
    const hasAuthor =
      metaContent(doc, "author") !== undefined || metaContent(doc, "article:author") !== undefined;
    const path = urlPath(url);
    if (hasAuthor && /\/20\d\d(\/|$)/.test(path)) return "blog";
    return "article";
  }

  const path = urlPath(url);
  const host = urlHost(url);
  if (host.startsWith("docs.") || /\/(docs|documentation|guide)/.test(path)) return "docs";
  if (/\/(reference|api|glossary)\//.test(path)) return "reference";
  if (/\/(blog|posts)\//.test(path)) return "blog";
  if (/\/product/.test(path)) return "product";
  return paragraphCount >= 3 ? "article" : "other";
}

function urlPath(url: string | null): string {
  if (!url) return "";
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function urlHost(url: string | null): string {
  if (!url) return "";
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

export function harvestMeta(doc: Document, opts: { url?: string }, paragraphCount: number): PageMeta {
  const jsonLd = parseJsonLd(doc).filter((r) => r !== undefined);

  const titleEl = findFirst(doc, (e) => tag(e) === "title");
  const h1 = findFirst(doc, (e) => tag(e) === "h1" && !isStripped(e));
  const title =
    metaContent(doc, "og:title") ??
    (titleEl ? collapseWs(rawText(titleEl)) : undefined) ??
    (h1 ? collapseInline(h1, isStripped) : "Untitled");

  const rawSummary = metaContent(doc, "description") ?? metaContent(doc, "og:description") ?? null;
  const summary = rawSummary ? truncateAtWord(collapseWs(rawSummary), 200) : null;

  const url = linkHref(doc, "canonical") ?? metaContent(doc, "og:url") ?? opts.url ?? null;

  const htmlEl = findFirst(doc, (e) => tag(e) === "html");
  const lang = htmlEl ? (attr(htmlEl, "lang")?.trim() || null) : null;

  const modifiedRaw = metaContent(doc, "article:modified_time") ?? null;
  const publishedRaw = metaContent(doc, "article:published_time") ?? null;
  let updated = (modifiedRaw && toIsoDate(modifiedRaw)) || (publishedRaw && toIsoDate(publishedRaw)) || null;
  if (!updated) {
    const timeEl = findFirst(doc, (e) => tag(e) === "time" && attr(e, "datetime") !== undefined);
    if (timeEl) updated = toIsoDate(attr(timeEl, "datetime")!);
  }

  return {
    title: collapseWs(title),
    summary,
    type: detectType(doc, url, jsonLd, paragraphCount),
    url,
    lang,
    updated,
    series: { prev: linkHref(doc, "prev") ?? null, next: linkHref(doc, "next") ?? null },
    jsonLd,
    author: metaContent(doc, "author") ?? null,
    published: publishedRaw ? toIsoDate(publishedRaw) : null,
    modified: modifiedRaw ? toIsoDate(modifiedRaw) : null,
  };
}
