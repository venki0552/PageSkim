import { afterEach, describe, expect, it, vi } from "vitest";
import { readStats, recordSavings } from "./stats";

const ENV_KEYS = [
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
] as const;

afterEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
  vi.restoreAllMocks();
});

function mockRedis(state: Record<string, number>) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
    expect(String(url)).toContain("/pipeline");
    const commands = JSON.parse(String(init?.body)) as string[][];
    const results = commands.map(([cmd, key, arg]) => {
      if (cmd === "INCR") return { result: String((state[key!] = (state[key!] ?? 0) + 1)) };
      if (cmd === "INCRBY") return { result: String((state[key!] = (state[key!] ?? 0) + Number(arg))) };
      return { result: state[key!] === undefined ? null : String(state[key!]) };
    });
    return new Response(JSON.stringify(results), { status: 200 });
  });
}

describe("stats store", () => {
  it("uses classic KV_REST_API_* env vars", async () => {
    process.env.KV_REST_API_URL = "https://kv.example";
    process.env.KV_REST_API_TOKEN = "tok";
    const state: Record<string, number> = {};
    const spy = mockRedis(state);
    await recordSavings(1000);
    const stats = await readStats();
    expect(spy).toHaveBeenCalled();
    expect(stats).toEqual({ conversions: 1, tokensSaved: 1000, persistent: true });
  });

  it("uses Upstash marketplace UPSTASH_REDIS_REST_* env vars", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://upstash.example";
    process.env.UPSTASH_REDIS_REST_TOKEN = "tok";
    const state: Record<string, number> = {};
    mockRedis(state);
    await recordSavings(500);
    await recordSavings(250);
    const stats = await readStats();
    expect(stats).toEqual({ conversions: 2, tokensSaved: 750, persistent: true });
  });

  it("falls back to in-memory with persistent: false when unconfigured", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    await recordSavings(123);
    const stats = await readStats();
    expect(spy).not.toHaveBeenCalled();
    expect(stats.persistent).toBe(false);
    expect(stats.tokensSaved).toBeGreaterThanOrEqual(123);
  });

  it("clamps absurd values", async () => {
    process.env.KV_REST_API_URL = "https://kv.example";
    process.env.KV_REST_API_TOKEN = "tok";
    const state: Record<string, number> = {};
    mockRedis(state);
    await recordSavings(999_999_999);
    expect(state["pageskim:tokens-saved"]).toBe(5_000_000);
  });
});
