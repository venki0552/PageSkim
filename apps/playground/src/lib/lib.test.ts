import { describe, expect, it } from "vitest";
import { convert } from "@pageskim/core";
import { rankChunks, selectChunks } from "./bm25";
import { dollarsSavedPer1k } from "./prices";
import { RateLimiter } from "./ratelimit";
import { isAllowedByRobots } from "./robots";
import { buildZip } from "./zip";
import { highlightJson, highlightMd } from "./highlight";
import { EXAMPLES } from "../generated/examples";

describe("rate limiter", () => {
  it("allows up to N per window then blocks", () => {
    const rl = new RateLimiter(3);
    const t = 1_000_000;
    expect(rl.allow("a", t)).toBe(true);
    expect(rl.allow("a", t + 1)).toBe(true);
    expect(rl.allow("a", t + 2)).toBe(true);
    expect(rl.allow("a", t + 3)).toBe(false);
    expect(rl.allow("b", t + 3)).toBe(true); // separate key
    expect(rl.allow("a", t + 61_000)).toBe(true); // window expired
  });
});

describe("robots.txt", () => {
  it("respects Disallow for *", () => {
    const robots = "User-agent: *\nDisallow: /private/\n";
    expect(isAllowedByRobots(robots, "/private/page")).toBe(false);
    expect(isAllowedByRobots(robots, "/public/page")).toBe(true);
  });
  it("longest match wins (Allow overrides broader Disallow)", () => {
    const robots = "User-agent: *\nDisallow: /docs/\nAllow: /docs/public/\n";
    expect(isAllowedByRobots(robots, "/docs/secret")).toBe(false);
    expect(isAllowedByRobots(robots, "/docs/public/ok")).toBe(true);
  });
  it("specific pageskimbot group takes precedence", () => {
    const robots = "User-agent: *\nDisallow: /\n\nUser-agent: PageSkimBot\nAllow: /\n";
    expect(isAllowedByRobots(robots, "/anything")).toBe(true);
  });
  it("wildcard patterns", () => {
    const robots = "User-agent: *\nDisallow: /*.pdf$\n";
    expect(isAllowedByRobots(robots, "/file.pdf")).toBe(false);
    expect(isAllowedByRobots(robots, "/file.pdf.html")).toBe(true);
  });
  it("empty robots allows everything", () => {
    expect(isAllowedByRobots("", "/x")).toBe(true);
  });
});

describe("two-hop scorer", () => {
  const article = EXAMPLES.find((e) => e.id === "article-infobox")!;
  const r = convert(article.html);
  if (!r.ok) throw new Error("convert failed");

  it("ranks the relevant chunk first for a targeted question", () => {
    const ranked = rankChunks(r.doc, "what height did travellers' measurements suggest?");
    expect(ranked[0]!.id).toBe("height-and-description");
  });

  it("selects between 1 and 3 chunks", () => {
    const selected = selectChunks(rankChunks(r.doc, "earthquakes destruction"));
    expect(selected.length).toBeGreaterThanOrEqual(1);
    expect(selected.length).toBeLessThanOrEqual(3);
    expect(selected).toContain("destruction");
  });
});

describe("zip builder", () => {
  it("produces a structurally valid zip (signatures + EOCD)", () => {
    const zip = buildZip({ "a.md": "hello", "b.md": "world" });
    // Local file header signature
    expect([zip[0], zip[1], zip[2], zip[3]]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    // End-of-central-directory signature exists
    const bytes = Array.from(zip);
    const eocd = bytes.findIndex(
      (_, i) => bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06,
    );
    expect(eocd).toBeGreaterThan(0);
  });
});

describe("highlighters escape HTML", () => {
  it("md", () => {
    expect(highlightMd("<script>alert(1)</script>")).not.toContain("<script>");
  });
  it("json", () => {
    expect(highlightJson('{"a": "<img>"}')).not.toContain("<img>");
  });
});

describe("prices", () => {
  it("computes $ saved per 1k requests", () => {
    // 10,000 tokens saved per request at $5/MTok → $0.05/request → $50/1k.
    expect(dollarsSavedPer1k(10_000, 5)).toBe(50);
  });
});
