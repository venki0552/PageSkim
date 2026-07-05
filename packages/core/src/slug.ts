/** Chunk-ID slugging per spec §7.2. Unicode-safe, deterministic. */

const VALID_ID = /^[\p{L}\p{N}][\p{L}\p{N}_-]*$/u;
export const RESERVED_IDS = new Set(["toc", "facts", "intro"]);

export function isValidId(id: string): boolean {
  return id.length > 0 && id.length <= 64 && VALID_ID.test(id) && !/^part-\d+$/.test(id);
}

/** Slugify heading text per spec §7.2 steps 1–6. */
export function slugify(text: string): string {
  let s = text.normalize("NFC").toLowerCase();
  s = s.replace(/[\s/–—·]+/gu, "-");
  s = s.replace(/[^\p{L}\p{N}_-]+/gu, "");
  s = s.replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "");
  if (s.length > 64) {
    const cut = s.slice(0, 64);
    const dash = cut.lastIndexOf("-");
    s = dash > 32 ? cut.slice(0, dash) : cut;
  }
  return s === "" ? "section" : s;
}

/** Deterministic dedupe: first use is bare, then -2, -3… in document order. */
export class SlugDeduper {
  private seen = new Map<string, number>();

  constructor(reserved: Iterable<string> = RESERVED_IDS) {
    for (const r of reserved) this.seen.set(r, 1);
  }

  /** Claim a slug. Reserved and previously-seen slugs get numeric suffixes. */
  claim(base: string): string {
    const n = this.seen.get(base);
    if (n === undefined) {
      this.seen.set(base, 1);
      return base;
    }
    let i = n + 1;
    while (this.seen.has(`${base}-${i}`)) i += 1;
    this.seen.set(base, i);
    this.seen.set(`${base}-${i}`, 1);
    return `${base}-${i}`;
  }

  /** Claim exactly this id (used for `intro`, `part-N`). */
  claimExact(id: string): string {
    this.seen.set(id, 1);
    return id;
  }
}
