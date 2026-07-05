/**
 * Minimal robots.txt check: is `path` allowed for our user agent?
 * Implements the longest-match rule over Allow/Disallow for the most
 * specific matching user-agent group ("pageskimbot" else "*").
 */

const BOT_TOKEN = "pageskimbot";

interface Rule {
  allow: boolean;
  pattern: string;
}

function parseGroups(robotsTxt: string): Map<string, Rule[]> {
  const groups = new Map<string, Rule[]>();
  let currentAgents: string[] = [];
  let lastWasAgent = false;
  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (line === "") continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (field === "user-agent") {
      if (!lastWasAgent) currentAgents = [];
      currentAgents.push(value.toLowerCase());
      for (const a of currentAgents) if (!groups.has(a)) groups.set(a, []);
      lastWasAgent = true;
    } else if (field === "allow" || field === "disallow") {
      lastWasAgent = false;
      if (value === "" && field === "disallow") continue; // empty disallow = allow all
      for (const a of currentAgents) {
        groups.get(a)?.push({ allow: field === "allow", pattern: value });
      }
    } else {
      lastWasAgent = false;
    }
  }
  return groups;
}

function matchLength(pattern: string, path: string): number {
  // robots patterns support * (any) and $ (end anchor).
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const parts = body.split("*").map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`^${parts.join(".*")}${anchored ? "$" : ""}`);
  return re.test(path) ? pattern.length : -1;
}

export function isAllowedByRobots(robotsTxt: string, path: string): boolean {
  const groups = parseGroups(robotsTxt);
  const rules =
    groups.get(BOT_TOKEN) ??
    [...groups.entries()].find(([agent]) => agent !== "*" && BOT_TOKEN.includes(agent))?.[1] ??
    groups.get("*");
  if (!rules || rules.length === 0) return true;
  let best: { len: number; allow: boolean } = { len: -1, allow: true };
  for (const rule of rules) {
    const len = matchLength(rule.pattern, path);
    if (len > best.len || (len === best.len && rule.allow && !best.allow)) {
      if (len >= 0) best = { len, allow: rule.allow };
    }
  }
  return best.allow;
}
