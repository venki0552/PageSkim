/**
 * Content extraction per spec §8: boilerplate stripping, main-content
 * selection, block extraction, and table classification.
 */

import {
  type AnyNode,
  type Document,
  Element,
  attr,
  children,
  collapseInline,
  isElement,
  isText,
  rawText,
  tag,
} from "./dom.js";
import { collapseWs } from "./text.js";

export type Block =
  | { kind: "heading"; level: number; text: string; id: string | null }
  | { kind: "para"; text: string }
  | { kind: "list"; text: string }
  | { kind: "quote"; text: string }
  | { kind: "code"; text: string; lang: string | null }
  | { kind: "figure"; text: string }
  | { kind: "tableref"; ref: number };

export interface RawTable {
  el: Element;
  kind: "infobox" | "data" | "layout";
  caption: string | null;
  /** Heading text most recently seen before this table (for table IDs). */
  precedingHeading: string | null;
}

export interface Extraction {
  blocks: Block[];
  /** Tables found in main content, classified, in document order. */
  tables: RawTable[];
  /** <dl> pairs found in main content, in document order. */
  dlPairs: { key: string; value: string }[];
  /** Raw text of the main content post-strip (input to §10 normalization). */
  mainText: string;
  /** Heavy-script signal for SPA detection. */
  scriptChars: number;
  /** id attributes (and <a name>) present anywhere in the original document. */
  htmlIds: Set<string>;
}

/* ---------------------------------------------------------- stripping */

const STRIP_TAGS = new Set([
  "script", "style", "noscript", "template", "iframe", "object", "embed",
  "canvas", "svg", "form", "button", "input", "select", "textarea", "label",
  "dialog", "link", "meta", "head", "title", "base",
]);

const STRIP_ALWAYS = new Set(["nav", "footer", "aside"]);

const STRIP_ROLES = new Set([
  "navigation", "banner", "contentinfo", "complementary", "search",
  "menu", "menubar", "alert", "alertdialog", "dialog",
]);

const STRIP_WORDS = new Set([
  "nav", "menu", "footer", "sidebar", "sidenav", "breadcrumb", "breadcrumbs",
  "crumbs", "cookie", "consent", "banner", "promo", "advert", "ad", "ads",
  "social", "share", "subscribe", "newsletter", "comment", "comments",
  "related", "recommended", "cross-sell", "pagination", "pager", "skip-link",
  "skip", "edit-tools", "feedback", "search", "toc", "masthead",
  "site-header", "site-footer",
]);

/** Spec §8.2 rule 4: token appears as a complete -/_/space-delimited word. */
function wordMatchesStripList(value: string): boolean {
  const words = value.toLowerCase().split(/[^a-z0-9-]+/);
  for (const word of words) {
    if (STRIP_WORDS.has(word)) return true;
    const parts = word.split("-");
    for (let i = 0; i < parts.length; i++) {
      if (STRIP_WORDS.has(parts[i]!)) return true;
      if (i + 1 < parts.length && STRIP_WORDS.has(`${parts[i]}-${parts[i + 1]}`)) return true;
    }
  }
  return false;
}

export function isStripped(el: Element): boolean {
  const t = tag(el);
  if (STRIP_TAGS.has(t)) return true;
  if (STRIP_ALWAYS.has(t)) return true;
  if (t === "header") {
    const parent = el.parent;
    const parentTag = parent && isElement(parent) ? tag(parent) : null;
    if (parentTag === "body" || parentTag === "html" || parentTag === null) return true;
    if (attr(el, "role") === "banner") return true;
  }
  const role = attr(el, "role");
  if (role && STRIP_ROLES.has(role.toLowerCase())) return true;
  if (attr(el, "aria-hidden") === "true" || attr(el, "hidden") !== undefined) return true;
  for (const a of ["class", "id", "aria-label"]) {
    const v = attr(el, a);
    if (v && wordMatchesStripList(v)) return true;
  }
  return false;
}

/* ------------------------------------------------- main-content selection */

/** Text of a subtree with stripped elements excluded, whitespace preserved. */
function strippedText(node: AnyNode): string {
  let out = "";
  const visit = (n: AnyNode): void => {
    if (isElement(n) && isStripped(n)) return;
    if (isText(n)) out += `${n.data} `;
    for (const c of children(n)) visit(c);
  };
  for (const c of children(node)) visit(c);
  return out;
}

function firstMatch(node: AnyNode, pred: (el: Element) => boolean): Element | undefined {
  if (isElement(node) && pred(node)) return node;
  for (const c of children(node)) {
    const found = firstMatch(c, pred);
    if (found) return found;
  }
  return undefined;
}

function allMatches(node: AnyNode, pred: (el: Element) => boolean): Element[] {
  const out: Element[] = [];
  const visit = (n: AnyNode): void => {
    if (isElement(n) && pred(n)) out.push(n);
    for (const c of children(n)) visit(c);
  };
  visit(node);
  return out;
}

export function selectMainContent(doc: Document): AnyNode {
  const body = firstMatch(doc, (el) => tag(el) === "body") ?? doc;
  const main = firstMatch(body, (el) => tag(el) === "main");
  if (main) return main;
  const articles = allMatches(body, (el) => tag(el) === "article" && !isStripped(el));
  if (articles.length > 0) {
    let best = articles[0]!;
    let bestLen = collapseWs(strippedText(best)).length;
    for (const a of articles.slice(1)) {
      const len = collapseWs(strippedText(a)).length;
      if (len > bestLen) {
        best = a;
        bestLen = len;
      }
    }
    return best;
  }
  const roleMain = firstMatch(body, (el) => attr(el, "role") === "main");
  if (roleMain) return roleMain;
  return body;
}

/* --------------------------------------------------- table classification */

/** All <tr> of this table (not of nested tables), as arrays of th/td cells. */
export function tableRows(el: Element): Element[][] {
  const rows: Element[][] = [];
  const visit = (n: AnyNode): void => {
    if (isElement(n)) {
      if (tag(n) === "table" && n !== el) return;
      if (tag(n) === "tr") {
        rows.push(
          children(n).filter(
            (c): c is Element => isElement(c) && (tag(c) === "th" || tag(c) === "td"),
          ),
        );
        return;
      }
    }
    for (const c of children(n)) visit(c);
  };
  for (const c of children(el)) visit(c);
  return rows;
}

export function classifyTable(el: Element): "infobox" | "data" | "layout" {
  if (firstMatch(el, (e) => tag(e) === "table" && e !== el)) return "layout";
  const rows = tableRows(el);
  if (rows.length === 0) return "layout";
  if (!rows.some((r) => r.some((c) => tag(c) === "th"))) return "layout";
  if (Math.max(...rows.map((r) => r.length)) < 2) return "layout";

  const thTd = rows.filter((r) => r.length === 2 && tag(r[0]!) === "th" && tag(r[1]!) === "td");
  // Real-world infoboxes (e.g. Wikipedia) mix in single-cell header/image
  // rows; a solid block of th+td pairs is the signal, not the ratio alone.
  if (thTd.length >= 4 || thTd.length / rows.length >= 0.8) return "infobox";

  const headerRow = rows.find((r) => r.length >= 2 && r.every((c) => tag(c) === "th"));
  if (headerRow && rows.filter((r) => r !== headerRow).length >= 2) return "data";
  return "layout";
}

/* ------------------------------------------------------- block extraction */

const HEADING = /^h([1-6])$/;

/** Tags dispatched as blocks; everything else is container-or-inline. */
const BLOCK_DISPATCH = new Set([
  "p", "pre", "ul", "ol", "blockquote", "figure", "img", "table", "dl", "hr",
]);

const CONTAINER_TAGS = new Set([
  "div", "section", "article", "main", "header", "hgroup", "details", "body",
  "address", "fieldset", "center",
]);

export function extract(doc: Document): Extraction {
  const htmlIds = new Set<string>();
  let scriptChars = 0;
  const scan = (n: AnyNode): void => {
    if (isElement(n)) {
      const id = attr(n, "id");
      if (id) htmlIds.add(id);
      if (tag(n) === "a") {
        const name = attr(n, "name");
        if (name) htmlIds.add(name);
      }
      if (tag(n) === "script") scriptChars += rawText(n).length + (attr(n, "src") ? 500 : 0);
    }
    for (const c of children(n)) scan(c);
  };
  scan(doc);

  const main = selectMainContent(doc);
  const blocks: Block[] = [];
  const tables: RawTable[] = [];
  const dlPairs: { key: string; value: string }[] = [];
  let lastHeading: string | null = null;

  const emitPara = (text: string): void => {
    const t = collapseWs(text);
    if (t !== "") blocks.push({ kind: "para", text: t });
  };

  const visitBlock = (el: Element): void => {
    const t = tag(el);
    const h = HEADING.exec(t);
    if (h) {
      // Malformed pages leave unclosed headings that swallow siblings as
      // children. Take leading inline content as the heading text; hand any
      // block-level children back to the normal flow.
      const inlineHead: AnyNode[] = [];
      const rest: AnyNode[] = [];
      for (const c of children(el)) {
        if (
          rest.length === 0 &&
          !(isElement(c) && (HEADING.test(tag(c)) || BLOCK_DISPATCH.has(tag(c)) || CONTAINER_TAGS.has(tag(c))))
        ) {
          inlineHead.push(c);
        } else {
          rest.push(c);
        }
      }
      let text = "";
      for (const c of inlineHead) {
        if (isText(c)) text += c.data;
        else if (isElement(c) && !isStripped(c)) text += ` ${collapseInline(c, isStripped)} `;
      }
      text = collapseWs(text);
      if (text !== "") {
        lastHeading = text;
        blocks.push({ kind: "heading", level: Number(h[1]), text, id: attr(el, "id") ?? null });
      }
      if (rest.length > 0) visitChildren(rest);
      return;
    }
    switch (t) {
      case "p":
        emitPara(collapseInline(el, isStripped));
        return;
      case "pre": {
        const codeEl = firstMatch(el, (e) => tag(e) === "code") ?? el;
        const cls = `${attr(codeEl, "class") ?? ""} ${attr(el, "class") ?? ""}`;
        const langMatch = /(?:language|lang|highlight)-([\w+#-]+)/.exec(cls);
        const code = rawText(el).replace(/^\n+/, "").replace(/\s+$/u, "");
        blocks.push({ kind: "code", text: code, lang: langMatch?.[1] ?? null });
        return;
      }
      case "ul":
      case "ol": {
        const lines = listLines(el, 0);
        if (lines.length > 0) blocks.push({ kind: "list", text: lines.join("\n") });
        return;
      }
      case "blockquote": {
        const inner = collapseInline(el, isStripped);
        if (inner !== "") blocks.push({ kind: "quote", text: `> ${inner}` });
        return;
      }
      case "figure": {
        const img = firstMatch(el, (e) => tag(e) === "img");
        const alt = img ? collapseWs(attr(img, "alt") ?? "") : "";
        const capEl = firstMatch(el, (e) => tag(e) === "figcaption");
        const cap = capEl ? collapseInline(capEl, isStripped) : "";
        const line = alt && cap ? `${alt} — ${cap}` : alt || cap;
        if (line !== "") blocks.push({ kind: "figure", text: `figure: ${line}` });
        return;
      }
      case "img": {
        const alt = collapseWs(attr(el, "alt") ?? "");
        if (alt !== "") blocks.push({ kind: "figure", text: `figure: ${alt}` });
        return;
      }
      case "table": {
        const kind = classifyTable(el);
        const capEl = firstMatch(el, (e) => tag(e) === "caption");
        tables.push({
          el,
          kind,
          caption: capEl ? collapseInline(capEl, isStripped) : null,
          precedingHeading: lastHeading,
        });
        if (kind === "layout") {
          for (const row of tableRows(el)) {
            emitPara(row.map((c) => collapseInline(c, isStripped)).join(" "));
          }
        } else if (kind === "data") {
          blocks.push({ kind: "tableref", ref: tables.length - 1 });
        }
        return;
      }
      case "dl": {
        let key: string | null = null;
        for (const c of children(el)) {
          if (!isElement(c)) continue;
          if (tag(c) === "dt") key = collapseInline(c, isStripped);
          else if (tag(c) === "dd" && key !== null) {
            dlPairs.push({ key, value: collapseInline(c, isStripped) });
            key = null;
          }
        }
        return;
      }
      default:
        return; // hr
    }
  };

  const visitChildren = (nodes: AnyNode[]): void => {
    let buf = "";
    const flush = (): void => {
      emitPara(buf);
      buf = "";
    };
    for (const c of nodes) {
      if (isText(c)) {
        buf += c.data;
        continue;
      }
      if (!isElement(c)) continue;
      if (isStripped(c)) continue;
      const t = tag(c);
      if (HEADING.test(t) || BLOCK_DISPATCH.has(t)) {
        flush();
        visitBlock(c);
      } else if (CONTAINER_TAGS.has(t) || hasBlockDescendant(c)) {
        flush();
        visitChildren(children(c));
      } else {
        buf += ` ${collapseInline(c, isStripped)} `;
      }
    }
    flush();
  };

  visitChildren(children(main));

  return { blocks, tables, dlPairs, mainText: strippedText(main), scriptChars, htmlIds };
}

function hasBlockDescendant(el: Element): boolean {
  for (const c of children(el)) {
    if (!isElement(c) || isStripped(c)) continue;
    const t = tag(c);
    if (HEADING.test(t) || BLOCK_DISPATCH.has(t) || CONTAINER_TAGS.has(t)) return true;
    if (hasBlockDescendant(c)) return true;
  }
  return false;
}

function listLines(el: Element, depth: number): string[] {
  const lines: string[] = [];
  for (const li of children(el)) {
    if (!isElement(li) || tag(li) !== "li" || isStripped(li)) continue;
    let text = "";
    const nested: Element[] = [];
    for (const c of children(li)) {
      if (isElement(c) && (tag(c) === "ul" || tag(c) === "ol")) nested.push(c);
      else if (isText(c)) text += c.data;
      else if (isElement(c) && !isStripped(c)) text += ` ${collapseInline(c, isStripped)} `;
    }
    const t = collapseWs(text);
    if (t !== "") lines.push(`${"  ".repeat(depth)}- ${t}`);
    for (const n of nested) lines.push(...listLines(n, depth + 1));
  }
  return lines;
}
