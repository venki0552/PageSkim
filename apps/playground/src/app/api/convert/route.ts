/**
 * POST /api/convert — free public conversion API (documented in the README).
 * Body: { "html": "<...>" } or { "url": "https://..." }.
 * Returns { llmMd, llmJson, splitFiles, tokenReport, warnings }.
 * No user content is stored. CORS is open. Rate limited per IP.
 */

import { NextRequest, NextResponse } from "next/server";
import { convert } from "@pageskim/core";
import { countTokens } from "@pageskim/core/tokenizer";
import { isAllowedByRobots } from "@/lib/robots";
import { RateLimiter } from "@/lib/ratelimit";
import { recordSavings } from "@/lib/stats";

export const runtime = "nodejs";

const limiter = new RateLimiter(20);
const MAX_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;
const USER_AGENT = "PageSkimBot/0.1 (+https://github.com/venki0552/PageSkim)";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function err(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status, headers: CORS });
}

export function OPTIONS(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS });
}

async function fetchPage(rawUrl: string): Promise<{ html: string } | NextResponse> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return err(400, "BAD_URL", "That doesn't look like a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return err(400, "BAD_URL", "Only http(s) URLs are supported.");
  }
  const host = url.hostname;
  if (
    host === "localhost" ||
    /^(\d+\.\d+\.\d+\.\d+)$/.test(host) ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return err(400, "BAD_URL", "Private and IP-literal hosts are not fetchable from here.");
  }

  // robots.txt: we identify honestly and respect Disallow.
  try {
    const robotsRes = await fetch(`${url.origin}/robots.txt`, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(5000),
    });
    if (robotsRes.ok) {
      const robots = await robotsRes.text();
      if (!isAllowedByRobots(robots, url.pathname)) {
        return err(
          403,
          "ROBOTS_DISALLOWED",
          "That site's robots.txt disallows fetching this page. You can still paste the page's HTML manually.",
        );
      }
    }
  } catch {
    // Unreachable robots.txt is treated as allow (standard practice).
  }

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow",
    });
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "TimeoutError";
    return err(
      502,
      timedOut ? "FETCH_TIMEOUT" : "FETCH_FAILED",
      timedOut
        ? "The page took more than 10 seconds to respond. Try pasting its HTML instead."
        : "Could not fetch that URL. The site may block bots — paste the page's HTML instead.",
    );
  }
  if (!res.ok) {
    return err(
      502,
      "FETCH_STATUS",
      `The site responded with HTTP ${res.status}. If it blocks bots, paste the page's HTML instead.`,
    );
  }
  const reader = res.body?.getReader();
  if (!reader) return err(502, "FETCH_FAILED", "Empty response body.");
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.length;
    if (received > MAX_BYTES) {
      void reader.cancel();
      return err(413, "TOO_LARGE", "Pages over 5 MB are not supported here.");
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(received);
  let pos = 0;
  for (const c of chunks) {
    buf.set(c, pos);
    pos += c.length;
  }
  return { html: new TextDecoder().decode(buf) };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!limiter.allow(ip)) {
    return err(429, "RATE_LIMITED", "Rate limit exceeded (20 conversions/minute). Try again shortly.");
  }

  let body: { html?: string; url?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return err(400, "BAD_JSON", 'Send JSON: {"html": "..."} or {"url": "https://..."}');
  }

  let html: string;
  let pageUrl: string | undefined;
  if (typeof body.html === "string" && body.html.length > 0) {
    if (body.html.length > MAX_BYTES) return err(413, "TOO_LARGE", "HTML over 5 MB is not supported.");
    html = body.html;
  } else if (typeof body.url === "string") {
    const fetched = await fetchPage(body.url);
    if (fetched instanceof NextResponse) return fetched;
    html = fetched.html;
    pageUrl = body.url;
  } else {
    return err(400, "BAD_INPUT", 'Provide "html" or "url".');
  }

  const result = convert(html, { countTokens, url: pageUrl });
  if (!result.ok) {
    return err(422, result.error.code, result.error.message);
  }

  await recordSavings(result.report.rawHtml - result.report.sibling);

  return NextResponse.json(
    {
      llmMd: result.md,
      llmJson: result.json,
      splitFiles: result.splitFiles,
      tokenReport: result.report,
      warnings: result.warnings,
      doc: result.doc,
    },
    { headers: CORS },
  );
}
