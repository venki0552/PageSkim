import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { budgetUnits, convert } from "@pageskim/core";
import { countTokens } from "@pageskim/core/tokenizer";
import {
  expose,
  fromDocument,
  fromHTML,
  hasTokenizer,
  PageSkimError,
  registerTokenizer,
  savings,
  tokenBasis,
  tokenCount,
  type ExposableDocument,
} from "./api.js";

const HTML = readFileSync(
  fileURLToPath(new URL("../../../examples/article-infobox/page.html", import.meta.url)),
  "utf8",
);

// Tokenizer registration is module-global; unregister between tests.
afterEach(() => {
  registerTokenizer(null);
});

describe("fromHTML ⇔ core parity (single source of truth)", () => {
  it("produces byte-identical .llm.md to core convert()", () => {
    const core = convert(HTML);
    if (!core.ok) throw new Error("core failed");
    expect(fromHTML(HTML).llmMd).toBe(core.md);
    expect(fromHTML(HTML).llmJson).toBe(core.json);
  });

  it("throws PageSkimError with the pre-render message on SPA input", () => {
    const spa = readFileSync(
      fileURLToPath(new URL("../../core/test/fixtures/spa.html", import.meta.url)),
      "utf8",
    );
    expect(() => fromHTML(spa)).toThrowError(PageSkimError);
    try {
      fromHTML(spa);
    } catch (e) {
      expect((e as PageSkimError).code).toBe("EMPTY_EXTRACTION");
    }
  });
});

describe("fromDocument", () => {
  it("converts a live-DOM-shaped object identically to fromHTML", () => {
    const inner = HTML.replace(/^<!DOCTYPE html>\n/, "");
    const fakeDoc = { documentElement: { outerHTML: inner } };
    expect(fromDocument(fakeDoc).llmMd).toBe(fromHTML(HTML).llmMd);
  });
});

describe("token counting", () => {
  it("defaults to the budget metric with an honest basis label", () => {
    expect(tokenCount("abcdefgh")).toBe(budgetUnits("abcdefgh"));
    expect(tokenBasis()).toContain("approximate");
  });

  it("registerTokenizer switches counts and the basis label", () => {
    registerTokenizer(countTokens);
    expect(hasTokenizer()).toBe(true);
    expect(tokenCount("The quick brown fox")).toBe(countTokens("The quick brown fox"));
    expect(tokenBasis()).toContain("o200k");
  });
});

describe("savings", () => {
  it("reports the counter numbers with percentages", () => {
    const s = savings(HTML);
    expect(s.rawTokens).toBeGreaterThan(s.siblingTokens);
    expect(s.siblingTokens).toBeGreaterThan(s.headerTokens);
    expect(s.savedPct).toBeGreaterThan(50);
    expect(s.headerSavedPct).toBeGreaterThan(95);
  });
});

describe("expose", () => {
  it("injects the script and link elements into a document-like object", () => {
    const appended: { tag: string; attrs: Record<string, string>; text: string | null }[] = [];
    const doc: ExposableDocument = {
      getElementById: () => null,
      querySelector: () => null,
      createElement: (tag: string) => {
        const el = {
          attrs: {} as Record<string, string>,
          textContent: null as string | null,
          setAttribute(name: string, value: string) {
            this.attrs[name] = value;
          },
          remove() {},
          tag,
        };
        return el;
      },
      head: {
        appendChild(node: unknown) {
          const el = node as { tag: string; attrs: Record<string, string>; textContent: string | null };
          appended.push({ tag: el.tag, attrs: el.attrs, text: el.textContent });
          return node;
        },
      },
    };
    expose(fromHTML(HTML), doc);
    expect(appended.map((a) => a.tag)).toEqual(["script", "link"]);
    expect(appended[0]!.attrs["type"]).toBe("text/llm+markdown");
    expect(appended[0]!.text).toContain("<!-- pageskim 0.1 -->");
    expect(appended[1]!.attrs["rel"]).toBe("alternate");
  });
});

describe("SSR safety", () => {
  it("module imported in Node without browser globals", () => {
    expect(typeof globalThis.window).toBe("undefined");
    expect(typeof globalThis.document).toBe("undefined");
  });
});
