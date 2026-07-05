/** Facts harvesting per spec §6.3, in normative order. */

import { collapseInline } from "./dom.js";
import { type Extraction, isStripped, tableRows } from "./extract.js";
import type { PageMeta } from "./meta.js";
import { SlugDeduper, slugify } from "./slug.js";
import { collapseWs, truncateAtWord } from "./text.js";
import { tag } from "./dom.js";
import type { FactKv, FactTable } from "./types.js";

const MAX_VALUE = 200;

function normKey(key: string): string {
  let k = collapseWs(key).toLowerCase().replaceAll(":", "-");
  if (k.length > 64) k = k.slice(0, 64).trim();
  return k;
}

function normValue(value: string): string {
  const v = collapseWs(value).replaceAll("\\", "\\\\");
  return truncateAtWord(v, MAX_VALUE);
}

/** schema.org URL values keep only the final path segment (spec §6.3). */
function schemaShort(value: string): string {
  const m = /^https?:\/\/(?:www\.)?schema\.org\/(.+)$/.exec(value);
  return m ? m[1]! : value;
}

function flattenJsonLd(node: unknown, prefix: string, out: FactKv[], depth: number): void {
  if (depth > 4 || node === null || node === undefined) return;
  if (typeof node === "string" || typeof node === "number" || typeof node === "boolean") {
    out.push({ key: prefix, value: schemaShort(String(node)) });
    return;
  }
  if (Array.isArray(node)) {
    if (node.every((v) => typeof v === "string" || typeof v === "number")) {
      out.push({ key: prefix, value: node.map((v) => schemaShort(String(v))).join(", ") });
    } else if (node.length <= 3) {
      node.forEach((v, i) => flattenJsonLd(v, `${prefix}.${i + 1}`, out, depth + 1));
    }
    return;
  }
  if (typeof node === "object") {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (k.startsWith("@")) {
        if (k === "@type" && typeof v === "string" && prefix !== "") {
          out.push({ key: `${prefix}.type`, value: v });
        }
        continue;
      }
      const key = prefix === "" ? k : `${prefix}.${k}`;
      flattenJsonLd(v, key, out, depth + 1);
    }
  }
}

export interface HarvestedFacts {
  kv: FactKv[];
  tables: FactTable[];
  /** Maps extraction table index → assigned table id (for tableref blocks). */
  tableIdByIndex: Map<number, string>;
}

export function harvestFacts(extraction: Extraction, meta: PageMeta): HarvestedFacts {
  const rawKv: FactKv[] = [];

  // 1. JSON-LD.
  for (const root of meta.jsonLd) {
    flattenJsonLd(root, "", rawKv, 0);
  }

  // 2. Meta tags.
  if (meta.author) rawKv.push({ key: "author", value: meta.author });
  if (meta.published) rawKv.push({ key: "published", value: meta.published });
  if (meta.modified) rawKv.push({ key: "modified", value: meta.modified });

  // 3. Definition lists.
  for (const { key, value } of extraction.dlPairs) {
    if (key !== "" && value !== "") rawKv.push({ key, value });
  }

  // 4. Infobox tables.
  for (const table of extraction.tables) {
    if (table.kind !== "infobox") continue;
    for (const row of tableRows(table.el)) {
      if (row.length !== 2 || tag(row[0]!) !== "th" || tag(row[1]!) !== "td") continue;
      const key = collapseInline(row[0]!, isStripped);
      const value = collapseInline(row[1]!, isStripped);
      if (key !== "" && value !== "") rawKv.push({ key, value });
    }
  }

  // Normalize + dedupe keys deterministically.
  const kv: FactKv[] = [];
  const seen = new Map<string, number>();
  for (const { key, value } of rawKv) {
    const k = normKey(key);
    const v = normValue(value);
    if (k === "" || v === "") continue;
    const n = seen.get(k);
    if (n === undefined) {
      seen.set(k, 1);
      kv.push({ key: k, value: v });
    } else {
      // Identical duplicate values collapse silently; different get suffix.
      const existing = kv.find((f) => f.key === k);
      if (existing && existing.value === v) continue;
      seen.set(k, n + 1);
      kv.push({ key: `${k}-${n + 1}`, value: v });
    }
  }

  // 5. Data tables.
  const tables: FactTable[] = [];
  const tableIdByIndex = new Map<number, string>();
  const ids = new SlugDeduper();
  let anon = 0;
  extraction.tables.forEach((table, index) => {
    if (table.kind !== "data") return;
    const rows = tableRows(table.el);
    const headerIdx = rows.findIndex((r) => r.length >= 2 && r.every((c) => tag(c) === "th"));
    if (headerIdx === -1) return;
    const header = rows[headerIdx]!;
    const cols = header.map((c) => slugify(collapseInline(c, isStripped)));
    const dataRows: string[][] = [];
    for (let i = 0; i < rows.length; i++) {
      if (i === headerIdx) continue;
      const row = rows[i]!;
      if (row.length !== cols.length) continue; // inconsistent row: skip (spec §6.2)
      dataRows.push(row.map((c) => collapseWs(collapseInline(c, isStripped))));
    }
    if (dataRows.length < 2) return;

    const idSource =
      table.el.attribs["id"] ??
      table.caption ??
      table.precedingHeading ??
      `table-${(anon += 1)}`;
    const id = ids.claim(slugify(idSource));
    tables.push({ id, cols, rows: dataRows });
    tableIdByIndex.set(index, id);
  });

  return { kv, tables, tableIdByIndex };
}
