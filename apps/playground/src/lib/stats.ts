/**
 * Aggregate "tokens saved by this playground" counter. No user content is
 * ever stored — just two integers. Uses Vercel KV via its REST API when the
 * standard env vars exist; otherwise an in-memory fallback (per instance,
 * resets on deploy — clearly labeled in the UI as approximate).
 */

interface Stats {
  conversions: number;
  tokensSaved: number;
}

const memory: Stats = { conversions: 0, tokensSaved: 0 };

function kvEnv(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

export async function recordSavings(tokensSaved: number): Promise<void> {
  const clamped = Math.max(0, Math.min(Math.floor(tokensSaved), 5_000_000));
  const kv = kvEnv();
  if (kv) {
    try {
      await fetch(`${kv.url}/pipeline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${kv.token}`, "Content-Type": "application/json" },
        body: JSON.stringify([
          ["INCR", "pageskim:conversions"],
          ["INCRBY", "pageskim:tokens-saved", String(clamped)],
        ]),
      });
      return;
    } catch {
      // fall through to memory
    }
  }
  memory.conversions += 1;
  memory.tokensSaved += clamped;
}

export async function readStats(): Promise<Stats> {
  const kv = kvEnv();
  if (kv) {
    try {
      const res = await fetch(`${kv.url}/pipeline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${kv.token}`, "Content-Type": "application/json" },
        body: JSON.stringify([
          ["GET", "pageskim:conversions"],
          ["GET", "pageskim:tokens-saved"],
        ]),
        cache: "no-store",
      });
      const data = (await res.json()) as { result: string | null }[];
      return {
        conversions: Number(data[0]?.result ?? 0),
        tokensSaved: Number(data[1]?.result ?? 0),
      };
    } catch {
      // fall through
    }
  }
  return { ...memory };
}
