import { describe, expect, it, vi } from "vitest";
import { NOT_IMPLEMENTED_MESSAGE, run } from "./index.js";

describe("generator stub", () => {
  it("exits non-zero and explains itself until Phase 2 lands", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(run([])).toBe(1);
    expect(spy).toHaveBeenCalledWith(NOT_IMPLEMENTED_MESSAGE);
    spy.mockRestore();
  });
});
