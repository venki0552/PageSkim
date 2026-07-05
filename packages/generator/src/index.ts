/**
 * @pageskim/generator — CLI wrapper around @pageskim/core.
 *
 *   pageskim generate <file|dir|-> [--out DIR] [--json] [--split]
 *                     [--site-index] [--base-url URL] [--quiet]
 *
 * All conversion logic lives in core; this package only does I/O, argument
 * parsing, and reporting.
 */

import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import {
  convert,
  emitSiteIndex,
  type ConvertSuccess,
  type SiteIndexEntry,
} from "@pageskim/core";
import { countTokens, TOKENIZER_LABEL } from "@pageskim/core/tokenizer";

export interface CliOptions {
  inputs: string[];
  out: string | null;
  json: boolean;
  split: boolean;
  siteIndex: boolean;
  baseUrl: string | null;
  quiet: boolean;
}

export const USAGE = `pageskim generate — emit PageSkim siblings for HTML pages

Usage:
  pageskim-generate <file.html|directory|-> [options]

Options:
  --out DIR        Write siblings under DIR (mirrors input structure).
                   Default: next to each input file.
  --json           Also emit the .llm.json rendering.
  --split          Also emit the split directory (page.llm/).
  --site-index     Write .well-known/pageskim.json (requires --out or a
                   directory input).
  --base-url URL   Base URL for pages without a canonical URL (joined with
                   the input-relative path).
  --quiet          Suppress the per-file token report.
  --help           Show this help.

Reads stdin when the input is "-" and writes the .llm.md to stdout.
Exit codes: 0 success, 1 usage/IO error, 2 extraction failed (SPA/empty).`;

export function parseArgs(argv: string[]): CliOptions | { error: string } {
  const opts: CliOptions = {
    inputs: [],
    out: null,
    json: false,
    split: false,
    siteIndex: false,
    baseUrl: null,
    quiet: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--json") opts.json = true;
    else if (a === "--split") opts.split = true;
    else if (a === "--site-index") opts.siteIndex = true;
    else if (a === "--quiet") opts.quiet = true;
    else if (a === "--out") {
      const v = argv[++i];
      if (!v) return { error: "--out requires a directory argument" };
      opts.out = v;
    } else if (a.startsWith("--out=")) opts.out = a.slice(6);
    else if (a === "--base-url") {
      const v = argv[++i];
      if (!v) return { error: "--base-url requires a URL argument" };
      opts.baseUrl = v;
    } else if (a.startsWith("--base-url=")) opts.baseUrl = a.slice(11);
    else if (a === "--help" || a === "-h") return { error: "" };
    else if (a.startsWith("--")) return { error: `Unknown option: ${a}` };
    else opts.inputs.push(a);
  }
  if (opts.inputs.length === 0) return { error: "No input given (file, directory, or -)." };
  return opts;
}

/** Recursively find page HTML files, skipping generated siblings. */
export function findHtmlFiles(root: string): string[] {
  const out: string[] = [];
  const visit = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : 1,
    )) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name.startsWith(".") || entry.name.endsWith(".llm"))
          continue;
        visit(full);
      } else if (/\.html?$/.test(entry.name) && !/\.llm\./.test(entry.name)) {
        out.push(full);
      }
    }
  };
  visit(root);
  return out;
}

/** page.html → page.llm.md (etc.) per spec §3.1. */
export function siblingPath(htmlPath: string, ext: string): string {
  return htmlPath.replace(/\.html?$/, "") + ext;
}

interface FileOutcome {
  file: string;
  result: ReturnType<typeof convert>;
}

function reportTable(outcomes: { file: string; r: ConvertSuccess }[]): string {
  const rows = outcomes.map(({ file, r }) => ({
    file,
    raw: r.report.rawHtml,
    sibling: r.report.sibling,
    header: r.report.headerOnly,
  }));
  const total = rows.reduce(
    (acc, r) => ({ raw: acc.raw + r.raw, sibling: acc.sibling + r.sibling, header: acc.header + r.header }),
    { raw: 0, sibling: 0, header: 0 },
  );
  const fmt = (r: { file: string; raw: number; sibling: number; header: number }): string =>
    `| ${r.file} | ${r.raw} | ${r.sibling} (${(r.raw / r.sibling).toFixed(1)}x) | ${r.header} (${(
      r.raw / r.header
    ).toFixed(0)}x) |`;
  return [
    "| page | raw HTML | .llm.md | header-only |",
    "| --- | ---: | ---: | ---: |",
    ...rows.map(fmt),
    outcomes.length > 1 ? fmt({ file: "TOTAL", ...total }) : "",
    `Token counts: ${TOKENIZER_LABEL}`,
  ]
    .filter((l) => l !== "")
    .join("\n");
}

export function run(argv: string[], io: { stdin?: string } = {}): number {
  const parsed = parseArgs(argv);
  if ("error" in parsed) {
    console.error(parsed.error === "" ? USAGE : `${parsed.error}\n\n${USAGE}`);
    return parsed.error === "" ? 0 : 1;
  }
  const opts = parsed;

  // stdin mode: convert one document to stdout.
  if (opts.inputs.length === 1 && opts.inputs[0] === "-") {
    const html = io.stdin ?? readFileSync(0, "utf8");
    const r = convert(html, { countTokens, url: opts.baseUrl ?? undefined });
    if (!r.ok) {
      console.error(`error: ${r.error.message}`);
      return 2;
    }
    process.stdout.write(opts.json ? r.json : r.md);
    for (const w of r.warnings) console.error(`warning: [${w.code}] ${w.message}`);
    return 0;
  }

  // Collect files.
  const files: { path: string; rel: string }[] = [];
  for (const input of opts.inputs) {
    let st;
    try {
      st = statSync(input);
    } catch {
      console.error(`error: cannot read ${input}`);
      return 1;
    }
    if (st.isDirectory()) {
      for (const f of findHtmlFiles(input)) files.push({ path: f, rel: relative(input, f) });
    } else {
      files.push({ path: input, rel: input.split("/").pop()! });
    }
  }
  if (files.length === 0) {
    console.error("error: no .html files found");
    return 1;
  }

  const outcomes: FileOutcome[] = [];
  const indexEntries: SiteIndexEntry[] = [];
  let hadEmpty = false;

  for (const { path, rel } of files) {
    const html = readFileSync(path, "utf8");
    const pageUrl = opts.baseUrl
      ? `${opts.baseUrl.replace(/\/$/, "")}/${rel.replace(/\\/g, "/")}`
      : undefined;
    const r = convert(html, { countTokens, url: pageUrl });
    outcomes.push({ file: path, result: r });
    if (!r.ok) {
      console.error(`error: ${path}: [${r.error.code}] ${r.error.message}`);
      hadEmpty = true;
      continue;
    }
    for (const w of r.warnings) {
      if (!opts.quiet) console.error(`warning: ${path}: [${w.code}] ${w.message}`);
    }

    const baseOut = opts.out ? join(opts.out, rel) : path;
    if (opts.out) mkdirSync(dirname(baseOut), { recursive: true });
    writeFileSync(siblingPath(baseOut, ".llm.md"), r.md);
    if (opts.json) writeFileSync(siblingPath(baseOut, ".llm.json"), r.json);
    if (opts.split) {
      const dir = siblingPath(baseOut, ".llm");
      mkdirSync(dir, { recursive: true });
      for (const [name, content] of Object.entries(r.splitFiles)) {
        writeFileSync(join(dir, name), content);
      }
    }

    const relUrl = `/${rel.replace(/\\/g, "/")}`;
    indexEntries.push({
      url: r.doc.url ?? relUrl,
      md: siblingPath(relUrl, ".llm.md"),
      json: opts.json ? siblingPath(relUrl, ".llm.json") : null,
      split: opts.split ? `${siblingPath(relUrl, ".llm")}/` : null,
      title: r.doc.title,
      hash: r.doc.hash,
      updated: r.doc.updated,
    });
  }

  if (opts.siteIndex) {
    const indexRoot = opts.out ?? (statSafeDir(opts.inputs[0]!) ? opts.inputs[0]! : null);
    if (indexRoot === null) {
      console.error("error: --site-index needs --out or a directory input");
      return 1;
    }
    const wellKnown = join(indexRoot, ".well-known");
    mkdirSync(wellKnown, { recursive: true });
    writeFileSync(join(wellKnown, "pageskim.json"), emitSiteIndex(indexEntries));
  }

  if (!opts.quiet) {
    const ok = outcomes.filter((o): o is { file: string; result: ConvertSuccess } & FileOutcome => o.result.ok);
    if (ok.length > 0) console.log(reportTable(ok.map((o) => ({ file: o.file, r: o.result }))));
  }

  return hadEmpty ? 2 : 0;
}

function statSafeDir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

export function resolvePath(p: string): string {
  return resolve(p);
}
