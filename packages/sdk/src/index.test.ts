import { describe, expect, it } from "vitest";
import { budgetUnits } from "@pageskim/core";
import { SPEC_VERSION, tokenCount } from "./index.js";

describe("sdk", () => {
  it("tokenCount matches core.budgetUnits (single source of truth)", () => {
    const text = "<h1>Same numbers everywhere</h1><p>CLI, SDK, playground.</p>";
    expect(tokenCount(text)).toBe(budgetUnits(text));
  });

  it("re-exports the spec version", () => {
    expect(SPEC_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("is SSR-safe: importing did not require window/document", () => {
    expect(typeof globalThis.window).toBe("undefined");
  });
});
