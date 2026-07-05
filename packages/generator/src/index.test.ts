import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findHtmlFiles, parseArgs, run, siblingPath } from "./index.js";

const EXAMPLES = fileURLToPath(new URL("../../../examples", import.meta.url));
const SPA_FIXTURE = fileURLToPath(
  new URL("../../core/test/fixtures/spa.html", import.meta.url),
);

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "pageskim-gen-"));
  cpSync(EXAMPLES, dir, { recursive: true });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("parseArgs", () => {
  it("parses flags and inputs", () => {
    const o = parseArgs(["site/", "--out", "dist", "--json", "--split", "--site-index"]);
    expect(o).toMatchObject({ inputs: ["site/"], out: "dist", json: true, split: true, siteIndex: true });
  });
  it("rejects unknown options", () => {
    expect(parseArgs(["--frobnicate"])).toHaveProperty("error");
  });
});

describe("directory generation", () => {
  it("emits siblings next to every page and a sorted site index", () => {
    const code = run([dir, "--json", "--split", "--site-index", "--base-url", "https://example.test", "--quiet"]);
    expect(code).toBe(0);
    for (const name of ["article-infobox", "docs", "blog", "product"]) {
      expect(existsSync(join(dir, name, "page.llm.md"))).toBe(true);
      expect(existsSync(join(dir, name, "page.llm.json"))).toBe(true);
      expect(existsSync(join(dir, name, "page.llm", "_header.md"))).toBe(true);
    }
    const index = JSON.parse(readFileSync(join(dir, ".well-known", "pageskim.json"), "utf8")) as {
      pageskim: string;
      pages: { url: string }[];
    };
    expect(index.pageskim).toBe("0.1");
    expect(index.pages.length).toBe(4);
    const urls = index.pages.map((p) => p.url);
    expect([...urls].sort()).toEqual(urls);
  });

  it("reruns are byte-identical (determinism through the CLI)", () => {
    run([dir, "--quiet"]);
    const first = readFileSync(join(dir, "docs", "page.llm.md"), "utf8");
    run([dir, "--quiet"]);
    expect(readFileSync(join(dir, "docs", "page.llm.md"), "utf8")).toBe(first);
  });

  it("matches the core golden fixtures exactly (same code path)", () => {
    run([dir, "--quiet"]);
    const golden = readFileSync(
      fileURLToPath(new URL("../../core/test/fixtures/expected/blog.llm.md", import.meta.url)),
      "utf8",
    );
    expect(readFileSync(join(dir, "blog", "page.llm.md"), "utf8")).toBe(golden);
  });

  it("--out mirrors the input structure", () => {
    const out = mkdtempSync(join(tmpdir(), "pageskim-out-"));
    try {
      expect(run([dir, "--out", out, "--quiet"])).toBe(0);
      expect(existsSync(join(out, "product", "page.llm.md"))).toBe(true);
      expect(existsSync(join(dir, "product", "page.llm.md"))).toBe(false);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});

describe("stdin mode", () => {
  it("writes the sibling to stdout", () => {
    const html = readFileSync(join(dir, "blog", "page.html"), "utf8");
    let stdout = "";
    const spy = vi.spyOn(process.stdout, "write").mockImplementation((s) => {
      stdout += String(s);
      return true;
    });
    const code = run(["-"], { stdin: html });
    spy.mockRestore();
    expect(code).toBe(0);
    expect(stdout).toContain("<!-- pageskim 0.1 -->");
  });
});

describe("failure modes", () => {
  it("SPA page exits 2 with the pre-render message", () => {
    const code = run([SPA_FIXTURE, "--quiet"]);
    expect(code).toBe(2);
  });

  it("missing input exits 1", () => {
    expect(run([join(dir, "does-not-exist.html")])).toBe(1);
  });
});

describe("helpers", () => {
  it("findHtmlFiles skips generated siblings and split dirs", () => {
    run([dir, "--split", "--quiet"]);
    const found = findHtmlFiles(dir);
    expect(found.length).toBe(4);
    expect(found.every((f) => !f.includes(".llm"))).toBe(true);
  });

  it("siblingPath maps names per spec §3.1", () => {
    expect(siblingPath("a/b/page.html", ".llm.md")).toBe("a/b/page.llm.md");
    expect(siblingPath("a/b/page.htm", ".llm.json")).toBe("a/b/page.llm.json");
  });
});
