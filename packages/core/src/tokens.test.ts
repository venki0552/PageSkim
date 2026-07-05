import { describe, expect, it } from "vitest";
import { budgetUnits, SPEC_VERSION } from "./index.js";
import { countTokens } from "./tokenizer.js";

describe("countTokens (tokenizer subpath)", () => {
  it("returns 0 for the empty string", () => {
    expect(countTokens("")).toBe(0);
  });

  it("counts a simple sentence", () => {
    const n = countTokens("The quick brown fox jumps over the lazy dog.");
    expect(n).toBeGreaterThan(5);
    expect(n).toBeLessThan(20);
  });

  it("is deterministic", () => {
    const text = "PageSkim makes websites readable by agents.";
    expect(countTokens(text)).toBe(countTokens(text));
  });

  it("handles non-English text", () => {
    expect(countTokens("こんにちは世界 — Grüße, мир")).toBeGreaterThan(0);
  });

  it("HTML markup costs more tokens than its text content", () => {
    const text = "Hello world, this is a paragraph about tokens.";
    const html = `<div class="content-wrapper"><p style="margin:0">${text}</p></div>`;
    expect(countTokens(html)).toBeGreaterThan(countTokens(text));
  });
});

describe("budgetUnits (spec §9)", () => {
  it("is ceil(utf8 bytes / 4)", () => {
    expect(budgetUnits("")).toBe(0);
    expect(budgetUnits("abcd")).toBe(1);
    expect(budgetUnits("abcde")).toBe(2);
    expect(budgetUnits("é")).toBe(1); // 2 bytes
  });
});

describe("SPEC_VERSION", () => {
  it("is a semver string", () => {
    expect(SPEC_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
