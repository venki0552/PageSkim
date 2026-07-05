/** Sliding-window in-memory rate limiter (per-IP). Good enough for the free
 * tier; swap for Vercel KV if the instance count grows. */

const WINDOW_MS = 60_000;

export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(private maxPerWindow: number) {}

  /** Returns true when the request is allowed. */
  allow(key: string, now = Date.now()): boolean {
    const cutoff = now - WINDOW_MS;
    const times = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (times.length >= this.maxPerWindow) {
      this.hits.set(key, times);
      return false;
    }
    times.push(now);
    this.hits.set(key, times);
    // Opportunistic GC so the map doesn't grow unboundedly.
    if (this.hits.size > 10_000) {
      for (const [k, v] of this.hits) {
        if (v.every((t) => t <= cutoff)) this.hits.delete(k);
      }
    }
    return true;
  }
}
