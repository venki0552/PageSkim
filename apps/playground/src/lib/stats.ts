/**
 * Aggregate "tokens saved by this playground" counter. No user content is
 * ever stored — just two integers. Uses an Upstash-protocol Redis REST API
 * when configured (Vercel KV / Vercel Marketplace "Upstash for Redis" both
 * speak it); otherwise an in-memory fallback (per instance, resets on
 * deploy — labeled as such via `persistent: false`).
 */

export interface Stats {
  conversions: number;
  tokensSaved: number;
  /** True when a Redis-backed store is configured (survives deploys). */
  persistent: boolean;
}

const memory = { conversions: 0, tokensSaved: 0 };

function kvEnv(): { url: string; token: string } | null {
  // Vercel KV (classic) and the Upstash marketplace integration inject
  // different variable names for the same REST API — accept both.
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

async function pipeline(commands: string[][]): Promise<{ result: string | null }[] | null> {
  const kv = kvEnv();
  if (!kv) return null;
  try {
    const res = await fetch(`${kv.url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${kv.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(commands),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as { result: string | null }[];
  } catch {
    return null;
  }
}

export async function recordSavings(tokensSaved: number): Promise<void> {
  const clamped = Math.max(0, Math.min(Math.floor(tokensSaved), 5_000_000));
  const done = await pipeline([
    ["INCR", "pageskim:conversions"],
    ["INCRBY", "pageskim:tokens-saved", String(clamped)],
  ]);
  if (done === null) {
    memory.conversions += 1;
    memory.tokensSaved += clamped;
  }
}

export async function readStats(): Promise<Stats> {
  const data = await pipeline([
    ["GET", "pageskim:conversions"],
    ["GET", "pageskim:tokens-saved"],
  ]);
  if (data !== null) {
    return {
      conversions: Number(data[0]?.result ?? 0),
      tokensSaved: Number(data[1]?.result ?? 0),
      persistent: true,
    };
  }
  return { ...memory, persistent: false };
}
