/**
 * @pageskim/validator — CLI wrapper around @pageskim/core's validateSibling.
 *
 *   pageskim validate <page.html> <page.llm.md|page.llm/> [--json] [--strict]
 *
 * Exit codes: 0 valid, 1 violations found, 2 usage/IO error.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseSibling, validateSibling, type Finding } from "@pageskim/core";

export const USAGE = `pageskim validate — check a PageSkim sibling against its page

Usage:
  pageskim-validate <page.html> <page.llm.md | page.llm/> [options]

Options:
  --json     Emit a machine-readable JSON report to stdout.
  --strict   Treat warnings as errors (exit 1 on any finding).
  --help     Show this help.

Checks: structural conformance, spec version, toc/chunk agreement, content
hash staleness, anchor resolution, header budget, facts wellformedness, and
grounding (every sentence must be derivable from the page HTML — flags
cloaked or injected content; boilerplate-only grounding is a warning).

Exit codes: 0 valid, 1 violations, 2 usage/IO error.`;

/** Reassemble a split directory into the combined document (spec §11). */
export function reassembleSplit(dir: string): string {
  const header = readFileSync(join(dir, "_header.md"), "utf8").replace(/\n$/, "");
  const facts = readFileSync(join(dir, "facts.md"), "utf8").replace(/\n$/, "");
  const tocs: string[] = [];
  for (const f of readdirSync(dir).sort()) {
    if (/^_toc-\d+\.md$/.test(f)) tocs.push(readFileSync(join(dir, f), "utf8").replace(/\n$/, ""));
  }
  // Chunk order comes from the header's TOC.
  const parsed = parseSibling(`${header}\n\n${facts}\n`);
  const chunkFiles: string[] = [];
  const ids = parsed.toc.length > 0 ? parsed.toc.map((t) => t.id) : listChunkIds(dir);
  for (const id of ids) {
    const p = join(dir, `${id}.md`);
    if (existsSync(p)) chunkFiles.push(readFileSync(p, "utf8").replace(/\n$/, ""));
  }
  return `${[header, ...tocs, facts, ...chunkFiles].join("\n\n")}\n`;
}

function listChunkIds(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md") && !f.startsWith("_") && f !== "facts.md")
    .sort()
    .map((f) => f.replace(/\.md$/, ""));
}

function formatFinding(f: Finding): string {
  return `${f.level === "error" ? "ERROR" : "warn "} [${f.code}] ${f.message}`;
}

export function run(argv: string[]): number {
  const args = argv.filter((a) => !a.startsWith("--"));
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  if (flags.has("--help") || flags.has("-h")) {
    console.log(USAGE);
    return 0;
  }
  for (const f of flags) {
    if (f !== "--json" && f !== "--strict") {
      console.error(`Unknown option: ${f}\n\n${USAGE}`);
      return 2;
    }
  }
  if (args.length !== 2) {
    console.error(USAGE);
    return 2;
  }
  const [htmlPath, siblingPath] = args as [string, string];

  let html: string;
  let md: string;
  try {
    html = readFileSync(htmlPath, "utf8");
    md = statSync(siblingPath).isDirectory()
      ? reassembleSplit(siblingPath)
      : readFileSync(siblingPath, "utf8");
  } catch (err) {
    console.error(`error: ${String(err)}`);
    return 2;
  }

  const result = validateSibling(html, md);
  const failing = flags.has("--strict") ? result.findings.length : result.errors;

  if (flags.has("--json")) {
    console.log(
      JSON.stringify(
        {
          valid: failing === 0,
          errors: result.errors,
          warnings: result.warnings,
          findings: result.findings,
        },
        null,
        2,
      ),
    );
  } else {
    for (const f of result.findings) console.error(formatFinding(f));
    console.error(
      failing === 0
        ? `valid: ${result.errors} errors, ${result.warnings} warnings`
        : `INVALID: ${result.errors} errors, ${result.warnings} warnings`,
    );
  }
  return failing === 0 ? 0 : 1;
}
