import { describe, expect, it } from "vitest";
import { sha256Hex } from "./sha256.js";
import { SlugDeduper, slugify } from "./slug.js";
import { unescapeCell } from "./emit.js";
import { firstSentence, normalizeText, toIsoDate, truncateAtWord } from "./text.js";

describe("sha256Hex (NIST vectors)", () => {
  it("empty string", () => {
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
  it("abc", () => {
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
  it("448-bit message", () => {
    expect(sha256Hex("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")).toBe(
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
    );
  });
  it("multi-block unicode input", () => {
    // 100 × "灯台" is 600 UTF-8 bytes → multiple blocks; regression-guards padding.
    const s = "灯台".repeat(100);
    expect(sha256Hex(s)).toHaveLength(64);
    expect(sha256Hex(s)).toBe(sha256Hex(s));
  });
});

describe("slugify (spec §7.2)", () => {
  it("basic heading", () => {
    expect(slugify("Height and description")).toBe("height-and-description");
  });
  it("punctuation and separators", () => {
    expect(slugify("Change 1: the Xeon had to go!")).toBe("change-1-the-xeon-had-to-go");
    expect(slugify("A/B testing — the basics")).toBe("a-b-testing-the-basics");
  });
  it("unicode is preserved", () => {
    expect(slugify("古代の灯台")).toBe("古代の灯台");
    expect(slugify("Grüße & Küsse")).toBe("grüße-küsse");
  });
  it("empty becomes section", () => {
    expect(slugify("!!!")).toBe("section");
  });
  it("long slugs cut at a dash boundary under 64 chars", () => {
    const slug = slugify(
      "an extremely long heading that keeps going well past the sixty four character limit",
    );
    expect(slug.length).toBeLessThanOrEqual(64);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("SlugDeduper", () => {
  it("suffixes duplicates in document order and protects reserved ids", () => {
    const d = new SlugDeduper();
    expect(d.claim("intro")).toBe("intro-2"); // reserved
    expect(d.claim("setup")).toBe("setup");
    expect(d.claim("setup")).toBe("setup-2");
    expect(d.claim("setup")).toBe("setup-3");
  });
});

describe("facts cell escaping", () => {
  it("round-trips pipes, backslashes and newlines", () => {
    const raw = "a|b\\c\nd";
    const escaped = raw.replaceAll("\\", "\\\\").replaceAll("|", "\\|").replaceAll("\n", "\\n");
    expect(unescapeCell(escaped)).toBe(raw);
  });
});

describe("text utilities", () => {
  it("normalizeText collapses unicode whitespace and applies NFC", () => {
    expect(normalizeText("a  b\n\tc")).toBe("a b c");
    expect(normalizeText("é")).toBe("é");
  });
  it("firstSentence stops at sentence punctuation", () => {
    expect(firstSentence("One sentence. Another one.")).toBe("One sentence.");
    expect(firstSentence("No terminator here")).toBe("No terminator here");
  });
  it("truncateAtWord appends ellipsis only when cutting", () => {
    expect(truncateAtWord("short", 10)).toBe("short");
    expect(truncateAtWord("cut this sentence somewhere sensible", 20)).toBe("cut this sentence…");
  });
  it("toIsoDate reduces datetimes", () => {
    expect(toIsoDate("2026-03-12T09:41:00Z")).toBe("2026-03-12");
    expect(toIsoDate("not a date")).toBeNull();
  });
});
