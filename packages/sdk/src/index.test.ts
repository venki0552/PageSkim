import { describe, expect, it } from "vitest";
import { countTokens } from "@agentpage/core";
import { SPEC_VERSION, tokenCount } from "./index.js";

describe("sdk", () => {
  it("tokenCount matches core.countTokens exactly (single source of truth)", () => {
    const text = "<h1>Same numbers everywhere</h1><p>CLI, SDK, playground.</p>";
    expect(tokenCount(text)).toBe(countTokens(text));
  });

  it("re-exports the spec version", () => {
    expect(SPEC_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("is SSR-safe: importing did not require window/document", () => {
    // This suite runs in Node (no DOM). Reaching this assertion proves the
    // module graph imported cleanly without browser globals.
    expect(typeof globalThis.window).toBe("undefined");
  });
});
