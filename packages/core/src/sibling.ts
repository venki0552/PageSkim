/** Parser for the .md rendering (spec §5) — the validator's front end. */

import { unescapeCell } from "./emit.js";

export interface ParsedChunk {
  id: string;
  summary: string | null;
  tags: string[];
  anchor: string | null; // "#frag", null = "none"
  anchorDeclared: boolean;
  text: string;
  line: number;
}

export interface ParsedTable {
  id: string;
  cols: string[];
  rows: string[][];
  malformedRows: number[]; // line numbers of rows with wrong cell counts
  line: number;
}

export interface ParsedSibling {
  version: { major: number; minor: number } | null;
  title: string | null;
  summary: string | null;
  meta: Record<string, string>;
  toc: { id: string; desc: string | null }[];
  grouped: boolean;
  factsKv: { key: string; value: string; line: number }[];
  factsTables: ParsedTable[];
  chunks: ParsedChunk[];
  /** Header portion of the file (marker through end of ## toc). */
  headerText: string;
  errors: { line: number; message: string }[];
}

const MARKER = /^<!-- pageskim (\d+)\.(\d+) -->$/;
const META_KEYS = new Set(["type", "url", "lang", "updated", "series-prev", "series-next", "hash"]);

function splitCells(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === "\\" && i + 1 < line.length) {
      cur += ch + line[i + 1]!;
      i += 1;
    } else if (ch === "|") {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells.map((c) => unescapeCell(c.trim()));
}

export function parseSibling(md: string): ParsedSibling {
  const lines = md.split("\n");
  const errors: ParsedSibling["errors"] = [];
  const out: ParsedSibling = {
    version: null,
    title: null,
    summary: null,
    meta: {},
    toc: [],
    grouped: false,
    factsKv: [],
    factsTables: [],
    chunks: [],
    headerText: "",
    errors,
  };

  const m = MARKER.exec(lines[0] ?? "");
  if (!m) errors.push({ line: 1, message: "missing or malformed version marker on line 1" });
  else out.version = { major: Number(m[1]), minor: Number(m[2]) };

  // Section boundaries.
  const sectionStarts: { line: number; heading: string }[] = [];
  lines.forEach((l, i) => {
    if (l.startsWith("## ")) sectionStarts.push({ line: i, heading: l.slice(3).trim() });
  });
  if (sectionStarts.length === 0) {
    errors.push({ line: 1, message: "no sections found (expected ## toc, ## facts, ## chunk …)" });
    return out;
  }

  // Header block (before first section) — title, summary, metadata.
  const headerEnd = sectionStarts[0]!.line;
  for (let i = 1; i < headerEnd; i++) {
    const l = lines[i]!;
    if (l === "") continue;
    if (l.startsWith("# ") && out.title === null) out.title = l.slice(2);
    else if (l.startsWith("> ") && out.summary === null) out.summary = l.slice(2);
    else {
      const kv = /^([a-z-]+): (.+)$/.exec(l);
      if (kv && META_KEYS.has(kv[1]!)) {
        if (kv[1]! in out.meta) errors.push({ line: i + 1, message: `duplicate metadata key ${kv[1]}` });
        out.meta[kv[1]!] = kv[2]!;
      } else {
        errors.push({ line: i + 1, message: `unexpected header line: ${l.slice(0, 60)}` });
      }
    }
  }
  if (out.title === null) errors.push({ line: 1, message: "missing title (# …)" });
  if (out.summary === null) errors.push({ line: 1, message: "missing summary (> …)" });
  if (!("type" in out.meta)) errors.push({ line: 1, message: "missing required metadata: type" });
  if (!("hash" in out.meta)) errors.push({ line: 1, message: "missing required metadata: hash" });
  else if (!/^sha256:[0-9a-f]{16}$/.test(out.meta["hash"]!))
    errors.push({ line: 1, message: "hash must be sha256:<16 lowercase hex>" });

  const sectionBody = (idx: number): { lines: string[]; start: number } => {
    const start = sectionStarts[idx]!.line + 1;
    const end = idx + 1 < sectionStarts.length ? sectionStarts[idx + 1]!.line : lines.length;
    return { lines: lines.slice(start, end), start };
  };

  let sawToc = false;
  let sawFacts = false;

  sectionStarts.forEach((section, idx) => {
    const { heading } = section;
    const body = sectionBody(idx);

    if (heading === "toc") {
      sawToc = true;
      out.headerText = lines.slice(0, idx + 1 < sectionStarts.length ? sectionStarts[idx + 1]!.line : lines.length)
        .join("\n")
        .replace(/\n+$/, "");
      for (const l of body.lines) {
        if (l === "") continue;
        const grouped = /^- (toc-\d+): (.+) \((\d+) chunks\)$/.exec(l);
        if (grouped) {
          out.grouped = true;
          continue;
        }
        const entry = /^- ([^\s:]+)(?:: (.*))?$/.exec(l);
        if (entry) out.toc.push({ id: entry[1]!, desc: entry[2] ?? null });
        else errors.push({ line: section.line + 1, message: `malformed toc entry: ${l.slice(0, 60)}` });
      }
    } else if (/^toc \d+$/.test(heading)) {
      for (const l of body.lines) {
        if (l === "") continue;
        const entry = /^- ([^\s:]+)(?:: (.*))?$/.exec(l);
        if (entry) out.toc.push({ id: entry[1]!, desc: entry[2] ?? null });
      }
    } else if (heading === "facts") {
      sawFacts = true;
      let table: ParsedTable | null = null;
      body.lines.forEach((l, j) => {
        const lineNo = body.start + j + 1;
        if (l === "") return;
        if (l.startsWith("@table ")) {
          if (table) errors.push({ line: lineNo, message: "@table opened before previous @end" });
          table = { id: l.slice(7).trim(), cols: [], rows: [], malformedRows: [], line: lineNo };
          return;
        }
        if (l === "@end") {
          if (!table) errors.push({ line: lineNo, message: "@end without @table" });
          else {
            if (table.cols.length < 2)
              errors.push({ line: table.line, message: `@table ${table.id}: fewer than 2 columns` });
            if (table.rows.length < 2)
              errors.push({ line: table.line, message: `@table ${table.id}: fewer than 2 rows` });
            out.factsTables.push(table);
          }
          table = null;
          return;
        }
        if (table) {
          if (l.startsWith("cols: ")) {
            table.cols = splitCells(l.slice(6));
            return;
          }
          const cells = splitCells(l);
          if (table.cols.length >= 2 && cells.length !== table.cols.length) {
            table.malformedRows.push(lineNo);
          }
          table.rows.push(cells);
          return;
        }
        const kv = /^- ([^:]+): (.*)$/.exec(l);
        if (kv) out.factsKv.push({ key: kv[1]!, value: kv[2]!, line: lineNo });
        else errors.push({ line: lineNo, message: `malformed facts line: ${l.slice(0, 60)}` });
      });
      if (table !== null) {
        errors.push({ line: (table as ParsedTable).line, message: "@table never closed with @end" });
      }
    } else if (heading.startsWith("chunk ")) {
      const id = heading.slice(6).trim();
      const chunk: ParsedChunk = {
        id,
        summary: null,
        tags: [],
        anchor: null,
        anchorDeclared: false,
        text: "",
        line: section.line + 1,
      };
      let i = 0;
      for (; i < body.lines.length; i++) {
        const l = body.lines[i]!;
        if (l.startsWith("summary: ")) chunk.summary = l.slice(9);
        else if (l.startsWith("tags: ")) chunk.tags = l.slice(6).split(", ");
        else if (l.startsWith("anchor: ")) {
          chunk.anchorDeclared = true;
          const a = l.slice(8);
          chunk.anchor = a === "none" ? null : a;
        } else break;
      }
      if (chunk.summary === null)
        errors.push({ line: chunk.line, message: `chunk ${id}: missing summary line` });
      if (!chunk.anchorDeclared)
        errors.push({ line: chunk.line, message: `chunk ${id}: missing anchor line` });
      chunk.text = body.lines.slice(i).join("\n").replace(/^\n+/, "").replace(/\n+$/, "");
      out.chunks.push(chunk);
    } else {
      errors.push({ line: section.line + 1, message: `unknown section: ## ${heading}` });
    }
  });

  if (!sawToc) errors.push({ line: 1, message: "missing ## toc section" });
  if (!sawFacts) errors.push({ line: 1, message: "missing ## facts section" });

  return out;
}
