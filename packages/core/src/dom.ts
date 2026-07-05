/** Thin helpers over htmlparser2/domhandler nodes. */

import { parseDocument } from "htmlparser2";
import { Element, Text, type AnyNode, type Document } from "domhandler";

export { Element, Text };
export type { AnyNode, Document };

export function parseHtml(html: string): Document {
  return parseDocument(html);
}

export function isElement(node: AnyNode): node is Element {
  return node.type === "tag" || node.type === "script" || node.type === "style";
}

export function isText(node: AnyNode): node is Text {
  return node.type === "text";
}

export function attr(el: Element, name: string): string | undefined {
  return el.attribs[name];
}

export function tag(el: Element): string {
  return el.name.toLowerCase();
}

export function children(node: AnyNode): AnyNode[] {
  return "children" in node ? (node.children as AnyNode[]) : [];
}

/** Depth-first walk; return false from `visit` to skip a subtree. */
export function walk(node: AnyNode, visit: (n: AnyNode) => boolean | void): void {
  if (visit(node) === false) return;
  for (const child of children(node)) walk(child, visit);
}

/** All text content of a subtree, raw (whitespace preserved). */
export function rawText(node: AnyNode): string {
  let out = "";
  walk(node, (n) => {
    if (isText(n)) out += n.data;
  });
  return out;
}

/** First element matching predicate, depth-first. */
export function findFirst(
  node: AnyNode,
  pred: (el: Element) => boolean,
): Element | undefined {
  let found: Element | undefined;
  walk(node, (n) => {
    if (found) return false;
    if (isElement(n) && pred(n)) {
      found = n;
      return false;
    }
  });
  return found;
}

/** All elements matching predicate, in document order. */
export function findAll(node: AnyNode, pred: (el: Element) => boolean): Element[] {
  const out: Element[] = [];
  walk(node, (n) => {
    if (isElement(n) && pred(n)) out.push(n);
  });
  return out;
}

export function elementsByTag(node: AnyNode, name: string): Element[] {
  return findAll(node, (el) => tag(el) === name);
}

/**
 * Flatten an element's inline content to prose text: tags dropped, inline
 * `code` kept in backticks, whitespace collapsed. Stripped elements
 * contribute nothing. `stripPred` lets the extractor pass its boilerplate
 * predicate without a circular import.
 */
export function collapseInline(
  node: AnyNode,
  stripPred?: (el: Element) => boolean,
): string {
  if (isElement(node) && tag(node) === "code") {
    const inner = rawText(node).replace(/\s+/gu, " ").trim();
    return inner === "" ? "" : `\`${inner}\``;
  }
  let out = "";
  const visit = (n: AnyNode): void => {
    if (isText(n)) {
      out += n.data;
      return;
    }
    if (!isElement(n)) return;
    if (stripPred?.(n)) return;
    const t = tag(n);
    if (t === "br") {
      out += " ";
      return;
    }
    if (t === "img") return; // inline images add no prose
    if (t === "code") {
      const inner = rawText(n).replace(/\s+/gu, " ").trim();
      if (inner !== "") out += `\`${inner}\``;
      return;
    }
    for (const c of children(n)) visit(c);
  };
  for (const c of children(node)) visit(c);
  return out.replace(/\s+/gu, " ").trim();
}

/** <meta> lookup by name= or property=, first match. */
export function metaContent(doc: Document, key: string): string | undefined {
  const el = findFirst(
    doc,
    (e) => tag(e) === "meta" && (attr(e, "name") === key || attr(e, "property") === key),
  );
  const content = el ? attr(el, "content") : undefined;
  return content?.trim() || undefined;
}

/** <link rel=…> href lookup, first match (rel is space-separated). */
export function linkHref(doc: Document, rel: string): string | undefined {
  const el = findFirst(doc, (e) => {
    if (tag(e) !== "link") return false;
    const rels = (attr(e, "rel") ?? "").toLowerCase().split(/\s+/);
    return rels.includes(rel);
  });
  const href = el ? attr(el, "href") : undefined;
  return href?.trim() || undefined;
}
