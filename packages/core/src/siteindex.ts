/** Site index (spec §13): /.well-known/pageskim.json */

import { SPEC_MARKER_VERSION } from "./convert.js";

export interface SiteIndexEntry {
  url: string;
  md: string;
  json: string | null;
  split: string | null;
  title: string;
  hash: string;
  updated: string | null;
}

export function emitSiteIndex(entries: SiteIndexEntry[]): string {
  const pages = [...entries].sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));
  return `${JSON.stringify({ pageskim: SPEC_MARKER_VERSION, pages }, null, 2)}\n`;
}
