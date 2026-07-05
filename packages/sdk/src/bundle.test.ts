import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { convert } from "@pageskim/core";

const dist = (name: string): string =>
  readFileSync(fileURLToPath(new URL(`../dist/${name}`, import.meta.url)), "utf8");

const HTML = readFileSync(
  fileURLToPath(new URL("../../../examples/blog/page.html", import.meta.url)),
  "utf8",
);

interface PageSkimGlobal {
  fromHTML: (html: string) => { llmMd: string; tokenReport: { rawHtml: number } };
  savings: (html: string) => { savedPct: number; basis: string };
  tokenCount: (t: string) => number;
  tokenBasis: () => string;
  registerTokenizer: (c: (t: string) => number) => void;
}

// Deliberately bare sandbox (no DOM): proves the bundle needs nothing beyond
// text primitives every real browser has (TextEncoder/TextDecoder/atob).
function makeSandbox(): Record<string, unknown> {
  const sandbox: Record<string, unknown> = { TextEncoder, TextDecoder, atob, btoa, console };
  sandbox["globalThis"] = sandbox;
  return sandbox;
}

function loadIife(order: "main-first" | "addon-first"): PageSkimGlobal {
  const sandbox = makeSandbox();
  const main = dist("pageskim.min.js");
  const addon = dist("pageskim.tokenizer.min.js");
  for (const src of order === "main-first" ? [main, addon] : [addon, main]) {
    runInNewContext(src, sandbox);
  }
  return sandbox["PageSkim"] as PageSkimGlobal;
}

describe("IIFE bundle (bare <script> usage, no build step)", () => {
  it("exposes a working global PageSkim and matches core output", () => {
    const PageSkim = loadIife("main-first");
    const core = convert(HTML);
    if (!core.ok) throw new Error("core failed");
    expect(PageSkim.fromHTML(HTML).llmMd).toBe(core.md);
  });

  it("stays under the 150KB gzipped budget (without tokenizer)", () => {
    const gz = gzipSync(dist("pageskim.min.js")).length;
    expect(gz).toBeLessThan(150 * 1024);
  });

  it("tokenizer addon registers in either load order", () => {
    for (const order of ["main-first", "addon-first"] as const) {
      const PageSkim = loadIife(order);
      expect(PageSkim.tokenBasis()).toContain("o200k");
      expect(PageSkim.tokenCount("The quick brown fox")).toBeGreaterThan(0);
    }
  });

  it("without the addon, counts fall back to the labeled estimator", () => {
    const sandbox = makeSandbox();
    runInNewContext(dist("pageskim.min.js"), sandbox);
    const PageSkim = sandbox["PageSkim"] as PageSkimGlobal;
    expect(PageSkim.tokenBasis()).toContain("approximate");
    expect(PageSkim.savings(HTML).savedPct).toBeGreaterThan(50);
  });
});
