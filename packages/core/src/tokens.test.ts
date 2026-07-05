import { describe, expect, it } from "vitest";
import { SPEC_VERSION, countTokens } from "./index.js";

describe("countTokens", () => {
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

describe("SPEC_VERSION", () => {
  it("is a semver-ish string", () => {
    expect(SPEC_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});
