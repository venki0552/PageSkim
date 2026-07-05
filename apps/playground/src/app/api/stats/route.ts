/** GET: aggregate counter. POST {saved}: record client-side (worker) savings. */

import { NextRequest, NextResponse } from "next/server";
import { readStats, recordSavings } from "@/lib/stats";
import { RateLimiter } from "@/lib/ratelimit";

export const runtime = "nodejs";

const limiter = new RateLimiter(30);

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(await readStats(), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!limiter.allow(ip)) return NextResponse.json({ ok: false }, { status: 429 });
  try {
    const { saved } = (await req.json()) as { saved?: number };
    if (typeof saved === "number" && Number.isFinite(saved)) {
      await recordSavings(saved);
    }
  } catch {
    // ignore malformed bodies; this endpoint is best-effort
  }
  return NextResponse.json({ ok: true });
}
