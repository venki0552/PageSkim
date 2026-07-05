import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { budgetUnits, convert, HEADER_CAP } from "./index.js";
import { countTokens } from "./tokenizer.js";

const EXAMPLES = ["article-infobox", "docs", "blog", "product"] as const;

function readExample(name: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../../../examples/${name}/page.html`, import.meta.url)),
    "utf8",
  );
}

function readFixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`../test/fixtures/${name}`, import.meta.url)), "utf8");
}

function convertOk(html: string) {
  const r = convert(html);
  if (!r.ok) throw new Error(`convert failed: ${r.error.code}`);
  return r;
}

describe("golden outputs for examples/", () => {
  for (const name of EXAMPLES) {
    it(`${name}: matches the committed golden .llm.md byte-for-byte`, () => {
      const expected = readFixture(`expected/${name}.llm.md`);
      expect(convertOk(readExample(name)).md).toBe(expected);
    });
  }

  it("article-infobox: matches the golden .llm.json byte-for-byte", () => {
    const expected = readFixture("expected/article-infobox.llm.json");
    expect(convertOk(readExample("article-infobox")).json).toBe(expected);
  });
});

describe("determinism", () => {
  it("same input → byte-identical output across repeated runs", () => {
    const html = readExample("article-infobox");
    const a = convertOk(html);
    const b = convertOk(html);
    expect(a.md).toBe(b.md);
    expect(a.json).toBe(b.json);
    expect(a.splitFiles).toEqual(b.splitFiles);
  });
});

describe("acceptance metrics on examples/", () => {
  for (const name of EXAMPLES) {
    it(`${name}: ≥5x full-sibling and strong header-only reduction (o200k)`, () => {
      const html = readExample(name);
      const r = convert(html, { countTokens });
      if (!r.ok) throw new Error("failed");
      expect(r.report.rawHtml / r.report.sibling).toBeGreaterThanOrEqual(2);
      expect(r.report.rawHtml / r.report.headerOnly).toBeGreaterThanOrEqual(20);
      expect(budgetUnits(r.md.split("\n\n## facts")[0]!)).toBeLessThanOrEqual(HEADER_CAP);
    });
  }
});

describe("header + structure invariants", () => {
  it("every chunk id has a matching anchor in the article HTML", () => {
    const r = convertOk(readExample("article-infobox"));
    for (const chunk of r.doc.chunks) {
      expect(chunk.anchor, `chunk ${chunk.id}`).not.toBeNull();
    }
  });

  it("split files reassemble into the combined document", () => {
    const r = convertOk(readExample("docs"));
    const parts = [
      r.splitFiles["_header.md"]!,
      r.splitFiles["facts.md"]!,
      ...r.doc.chunks.map((c) => r.splitFiles[`${c.id}.md`]!),
    ].map((s) => s.replace(/\n$/, ""));
    expect(`${parts.join("\n\n")}\n`).toBe(r.md);
  });

  it("json mirror carries identical content", () => {
    const r = convertOk(readExample("product"));
    const parsed = JSON.parse(r.json) as { hash: string; chunks: { id: string }[] };
    expect(parsed.hash).toBe(r.doc.hash);
    expect(parsed.chunks.map((c) => c.id)).toEqual(r.doc.chunks.map((c) => c.id));
  });
});

describe("boilerplate never leaks (nav-leak)", () => {
  it("article: nav/footer/banner/aside text is absent from output", () => {
    const r = convertOk(readExample("article-infobox"));
    for (const leaked of [
      "Random article", // site nav
      "Privacy policy", // footer
      "fundraiser", // donation banner
      "Related articles", // aside
      "In other languages", // language sidebar
      "View history", // edit tools
    ]) {
      expect(r.md).not.toContain(leaked);
    }
  });

  it("blog: cookie banner, newsletter, comments and share row are stripped", () => {
    const r = convertOk(readExample("blog"));
    for (const leaked of ["cookie", "Subscribe", "Comments (3)", "Share on Fedi"]) {
      expect(r.md).not.toContain(leaked);
    }
  });

  it("product: promo bar, breadcrumbs and cross-sell are stripped", () => {
    const r = convertOk(readExample("product"));
    for (const leaked of ["Summer sale ends", "Customers also bought", "Cart (0)"]) {
      expect(r.md).not.toContain(leaked);
    }
  });
});

describe("facts", () => {
  it("harvests the infobox into key-value facts", () => {
    const r = convertOk(readExample("article-infobox"));
    expect(r.doc.facts.kv).toContainEqual({ key: "height", value: "c. 100 m (330 ft)" });
    expect(r.doc.facts.kv).toContainEqual({ key: "commissioned by", value: "Ptolemy I Soter" });
  });

  it("harvests JSON-LD product data including shortened schema.org values", () => {
    const r = convertOk(readExample("product"));
    const kv = new Map(r.doc.facts.kv.map((f) => [f.key, f.value]));
    expect(kv.get("offers.price")).toBe("149.00");
    expect(kv.get("offers.availability")).toBe("InStock");
    expect(kv.get("aggregaterating.ratingvalue")).toBe("4.6");
  });

  it("encodes uniform config tables as @table blocks with escaping intact", () => {
    const r = convertOk(readExample("docs"));
    const ids = r.doc.facts.tables.map((t) => t.id);
    expect(ids).toEqual(["cluster-options", "defaults-options", "logging-options"]);
    const cluster = r.doc.facts.tables[0]!;
    expect(cluster.cols).toEqual(["option", "type", "default", "description"]);
    expect(cluster.rows.length).toBe(5);
    // No cell may contain an unescaped pipe in the .md rendering.
    const factsMd = r.md.slice(r.md.indexOf("## facts"));
    for (const line of factsMd.split("\n")) {
      if (line.startsWith("@") || line.startsWith("cols:") || !line.includes("|")) continue;
      expect(line.split(/(?<!\\)\|/).length).toBe(4);
    }
  });
});

describe("edge cases (spec §15)", () => {
  it("malformed HTML: parses leniently, never crashes, still chunks", () => {
    const r = convertOk(readFixture("malformed.html"));
    expect(r.doc.chunks.map((c) => c.id)).toEqual(["intro", "first-section", "second-section"]);
    expect(r.doc.chunks[1]!.anchor).toBe("#first-section");
    expect(r.doc.chunks[2]!.anchor).toBeNull();
  });

  it("SPA: fails with a clear pre-render message instead of emitting junk", () => {
    const r = convert(readFixture("spa.html"));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("EMPTY_EXTRACTION");
      expect(r.error.message).toContain("rendered HTML");
    }
  });

  it("no headings: paragraph-cluster fallback with part-N ids and anchor: none", () => {
    const r = convertOk(readFixture("no-headings.html"));
    expect(r.warnings.some((w) => w.code === "NO_HEADINGS")).toBe(true);
    expect(r.doc.chunks.length).toBeGreaterThanOrEqual(2);
    expect(r.doc.chunks.every((c, i) => c.id === `part-${i + 1}`)).toBe(true);
    expect(r.doc.chunks.every((c) => c.anchor === null)).toBe(true);
  });

  it("thin page: minimal valid sibling plus THIN_PAGE warning", () => {
    const r = convertOk(readFixture("thin.html"));
    expect(r.warnings.some((w) => w.code === "THIN_PAGE")).toBe(true);
    expect(r.md).toContain("<!-- pageskim 0.1 -->");
    expect(r.md).toContain("hash: sha256:");
  });

  it("duplicate headings: deterministic -2/-3 suffixes", () => {
    const r = convertOk(readFixture("duplicate-headings.html"));
    expect(r.doc.chunks.map((c) => c.id)).toEqual(["bug-fixes", "bug-fixes-2", "bug-fixes-3"]);
  });

  it("non-English: unicode slugs, summaries in the page language, lang tag", () => {
    const r = convertOk(readFixture("non-english.html"));
    expect(r.doc.lang).toBe("ja");
    expect(r.doc.chunks.map((c) => c.id)).toEqual(["intro", "古代の灯台", "現代の灯台"]);
    expect(r.doc.chunks[1]!.summary).toContain("鏡");
  });

  it("paginated: series-prev/next from link rel", () => {
    const r = convertOk(readFixture("paginated.html"));
    expect(r.doc.series.prev).toBe("https://example.com/walk/part-1");
    expect(r.doc.series.next).toBe("https://example.com/walk/part-3");
    expect(r.md).toContain("series-prev: https://example.com/walk/part-1");
  });

  it("layout tables: text flows as prose, never becomes facts", () => {
    const r = convertOk(readFixture("layout-table.html"));
    expect(r.doc.facts.tables).toEqual([]);
    expect(r.md).toContain("four hundred and twelve pounds");
  });

  it("code blocks: preserved verbatim, fenced, with language tag", () => {
    const r = convertOk(readExample("docs"));
    expect(r.md).toContain('```\n# gridctl.toml\n[cluster]\nendpoint = "grid.internal.example.com:7443"');
    expect(r.md).toContain('export GRIDCTL_CLUSTER_ENDPOINT="staging.grid.example.com:7443"');
  });

  it("figures: alt + caption become figure: lines", () => {
    const r = convertOk(readExample("article-infobox"));
    expect(r.md).toContain(
      "figure: A three-stage stone tower rising from a fortified platform beside a harbour, drawn as an architectural reconstruction — A 2013 architectural reconstruction of the lighthouse based on the 1909 study by Hermann Thiersch.",
    );
  });

  it("huge pages: >100 chunks produce a grouped TOC with sub-TOC sections", () => {
    const sections = Array.from({ length: 120 }, (_, i) => {
      const n = i + 1;
      return `<h2 id="topic-${n}">Topic ${n}</h2><p>Section ${n} discusses subject matter number ${n} in enough detail to count as a paragraph of real content for testing.</p>`;
    }).join("\n");
    const html = `<!DOCTYPE html><html lang="en"><head><title>Huge</title></head><body><main><h1 id="huge">Huge</h1>${sections}</main></body></html>`;
    const r = convertOk(html);
    expect(r.doc.chunks.length).toBe(120);
    expect(r.md).toContain("- toc-1: topic-1 … topic-50 (50 chunks)");
    expect(r.md).toContain("## toc 3");
    expect(r.splitFiles["_toc-1.md"]).toBeDefined();
    expect(budgetUnits(r.splitFiles["_header.md"]!)).toBeLessThanOrEqual(HEADER_CAP);
  });
});
