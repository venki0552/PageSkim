# PageSkim Format Specification

**Version 0.1.0 — Draft**

PageSkim is a static-file format that gives every HTML page a compact, layered
sibling document that LLMs and agents can read at a fraction of the token cost
of raw HTML, without servers, RAG pipelines, or vector databases.

The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are to be
interpreted as described in RFC 2119.

---

## Table of contents

1. [Overview and goals](#1-overview-and-goals)
2. [Terminology](#2-terminology)
3. [Naming and discovery](#3-naming-and-discovery)
4. [Document structure](#4-document-structure)
5. [The `.md` rendering: grammar](#5-the-md-rendering-grammar)
6. [The facts encoding](#6-the-facts-encoding)
7. [Chunk identity and anchors](#7-chunk-identity-and-anchors)
8. [Content extraction](#8-content-extraction)
9. [The budget metric and header limits](#9-the-budget-metric-and-header-limits)
10. [Hash computation](#10-hash-computation)
11. [Split-file layout and the two-hop contract](#11-split-file-layout-and-the-two-hop-contract)
12. [The `.json` rendering and JSON Schema](#12-the-json-rendering-and-json-schema)
13. [Site index](#13-site-index)
14. [Trust rules](#14-trust-rules)
15. [Edge-case behaviors](#15-edge-case-behaviors)
16. [Design rationale](#16-design-rationale)
17. [Versioning and changelog policy](#17-versioning-and-changelog-policy)
18. [Worked example](#18-worked-example)

---

## 1. Overview and goals

For every human-facing HTML page, a publisher emits a **sibling** file with
exactly three layers:

1. **HEADER** — identity and a table of contents: enough for an agent to decide
   *whether and where* to read further, in ≤100 tokens (150 hard cap).
2. **FACTS** — the page's verifiable data points (dates, numbers, names,
   prices, relations), compactly encoded.
3. **CHUNKS** — each content section as **plain prose**, individually
   addressable by a stable ID that maps to an anchor in the human HTML.

Agents follow a **two-hop retrieval contract**: fetch the header, choose chunk
IDs, then fetch only those chunks. Design goals, in priority order:

1. **Zero infrastructure for adopters.** Static files only. Generators and
   validators MUST NOT require network access at conversion time.
2. **Trustworthy.** Sibling content MUST be derivable from the human-visible
   HTML (§14). No cloaking, no injected instructions.
3. **Deterministic.** Same input HTML ⇒ byte-identical sibling output for a
   given generator version.
4. **Serialization-flexible.** `.md` (primary) and `.json` are equivalent
   renderings of the same structure; consumers may prefer either.
5. **Token-frugal, reasoning-friendly.** Uniform data is tabular; narrative
   text stays prose (see §16 for why).

## 2. Terminology

- **Page**: the human-facing HTML document.
- **Sibling**: the PageSkim document derived from a page (`.llm.md`,
  `.llm.json`, or split directory).
- **Header**: layer 1 — everything from the version marker through the end of
  the `## toc` section.
- **Chunk**: one addressable content section.
- **Reference tokenizer**: the `o200k_base` encoding, used for *reported*
  token counts. Reported counts are estimates; exact counts vary by model.
- **Budget metric**: the tokenizer-independent size measure defined in §9,
  used for all *content-affecting* decisions.
- **Main content**: the extraction result defined in §8.
- **Normalized text**: the transformation defined in §10.

## 3. Naming and discovery

### 3.1 Sibling names

For a page at path `P`:

| Page path | Combined `.md` sibling | `.json` sibling | Split directory |
| --- | --- | --- | --- |
| `dir/page.html` (or `.htm`) | `dir/page.llm.md` | `dir/page.llm.json` | `dir/page.llm/` |
| `dir/` (directory URL) | `dir/index.llm.md` | `dir/index.llm.json` | `dir/index.llm/` |
| `dir/page` (extensionless) | `dir/page.llm.md` | `dir/page.llm.json` | `dir/page.llm/` |

The combined `.md` sibling is REQUIRED; the `.json` sibling and split
directory are OPTIONAL mirrors. When both exist they MUST encode identical
content.

### 3.2 Discovery

Publishers SHOULD advertise siblings by any of:

1. `<link rel="alternate" type="text/llm+markdown" href="page.llm.md">` in the
   page `<head>`.
2. An HTTP `Link` header with the same relation.
3. The site index at `/.well-known/pageskim.json` (§13).

Consumers SHOULD attempt the site index first, then the `link` relation, then
the naming convention. Siblings SHOULD be served as `text/markdown;
charset=utf-8` (or `application/json` for the `.json` rendering).

## 4. Document structure

A sibling document consists of, in order:

1. **Version marker** (required).
2. **Title** (required).
3. **Summary** (required).
4. **Metadata block** (required keys: `type`, `hash`; conditional: `url`,
   `lang`, `updated`, `series-prev`, `series-next`).
5. **`toc` section** (required; lists every chunk ID).
6. **`facts` section** (required; MAY be empty).
7. **One `chunk` section per TOC entry** (in TOC order).

Items 1–5 constitute the **header** and are subject to the budget in §9.

## 5. The `.md` rendering: grammar

### 5.1 Encoding and line discipline

Files MUST be UTF-8 without BOM, with LF (`\n`) line endings, ending in
exactly one trailing `\n`. Lines MUST NOT have trailing whitespace.
Consecutive blank lines MUST be collapsed to one.

### 5.2 Grammar

The grammar below is line-oriented. `{…}` denotes a value; literal text is
verbatim. Optional lines are marked *(opt)*.

```
<!-- pageskim {MAJOR}.{MINOR} -->
# {title}

> {summary}

type: {article|docs|product|blog|reference|other}
url: {canonical-url}                                  (opt: omit if unknown)
lang: {BCP-47 tag}                                    (opt)
updated: {YYYY-MM-DD}                                 (opt)
series-prev: {url}                                    (opt)
series-next: {url}                                    (opt)
hash: sha256:{64 lowercase hex}

## toc
- {chunk-id}: {one-line description}
- {chunk-id}                                          (descriptions dropped under budget pressure, §9)

## facts
- {key}: {value}
@table {table-id}
cols: {col}|{col}|…
{cell}|{cell}|…
@end

## chunk {chunk-id}
summary: {one line}
tags: {slug}, {slug}, …                               (opt)
anchor: #{fragment} | none

{prose blocks, separated by blank lines}
```

Rules:

- The version marker MUST be the first line. Parsers MUST reject files whose
  MAJOR version they do not support and SHOULD accept unknown MINOR versions.
- `title` is a single line; embedded newlines are forbidden.
- `summary` is a single line beginning `> `.
- Metadata keys appear at most once, in the order shown. Unknown keys MUST be
  ignored by parsers (forward compatibility) and MUST NOT be emitted by
  generators at this version.
- Section openers are exactly `## toc`, `## facts`, `## chunk {id}`, and (for
  huge pages, §15) `## toc {n}`. A parser splits the document on lines
  matching `/^## /`.
- Every TOC entry MUST have a corresponding `## chunk` section and vice versa;
  order MUST match.
- Chunk sections start with `summary:`, then optional `tags:`, then required
  `anchor:`, then a blank line, then the prose.

### 5.3 Prose blocks inside chunks

Chunk prose is GitHub-flavored-markdown-compatible plain text:

- Paragraphs: plain lines. Narrative text MUST remain prose — generators MUST
  NOT convert running text into key-value or tabular structures (§16).
- Lists: `- ` items (2-space indent per nesting level).
- Block quotes: `> ` prefix.
- Code: fenced with triple backticks, with a language token when known. Code
  MUST be preserved verbatim — never summarized, reflowed, or elided.
- Figures: a single line `figure: {alt text}` or
  `figure: {alt text} — {caption}`.
- Data tables are NOT rendered in chunks; the chunk carries a reference line
  `table: {table-id}` and the data lives in facts (§6).
- Inline markup is flattened to text. Inline code keeps backticks. Link
  targets are dropped (text only).

## 6. The facts encoding

The `## facts` section contains, in this order: key-value lines, then table
blocks. Either may be absent; the section heading is always present.

### 6.1 Key-value lines

```
- {key}: {value}
```

- Keys: lowercase (per Unicode default case folding), whitespace collapsed to
  single spaces, `:` forbidden (replace with `-`), ≤64 characters. Keys keep
  the page's language — they are not translated.
- Values: single line; whitespace collapsed; literal `\` escaped as `\\` and
  newlines as `\n`; truncated at 200 characters at a word boundary with a
  trailing `…` if longer.
- Duplicate keys are deduplicated in document order with `-2`, `-3`… suffixes.

### 6.2 Table blocks (TOON-style)

Uniform, records-like data uses a compact tabular block:

```
@table {table-id}
cols: {col}|{col}|{col}
{cell}|{cell}|{cell}
{cell}|{cell}|{cell}
@end
```

- `table-id` follows chunk-ID syntax (§7.2) and is unique within the document
  (deduplicated with `-2`, `-3`…).
- `cols:` declares column names: slugified header cells (§7.2), `|`-joined.
- Each subsequent line until `@end` is one record; cell count MUST equal
  column count.
- **Escaping** (applies to cells and column names): `\\` = literal backslash,
  `\|` = literal pipe, `\n` = newline. Cells are trimmed of surrounding
  whitespace; an empty cell is the empty string.
- **When NOT to use a table block**: fewer than 2 data rows, no header row
  derivable, rows with inconsistent cell counts, or >40% empty cells — encode
  as key-value lines (or leave as chunk prose if not fact-like). Layout
  tables are never facts (§8.4).

### 6.3 Harvest order

Generators harvest facts in this normative order (stable across runs):

1. **JSON-LD** (`<script type="application/ld+json">`, document order):
   flatten nested objects to dotted keys (`offers.price`); keys beginning `@`
   are skipped except `@type`, which is emitted as `type` within its path
   prefix. Arrays of primitives join with `, `; arrays of objects flatten with
   index suffixes only when ≤3 elements, else skipped. Values that are
   `schema.org/...` URLs keep only the final path segment (`InStock`).
2. **Meta tags**: `author`, `article:published_time` → `published`,
   `article:modified_time` → `modified` (dates reduced to `YYYY-MM-DD`).
3. **Definition lists** (`<dl>` in main content): `dt`→key, `dd`→value.
4. **Infobox tables**: tables in main content where ≥80% of rows are exactly
   one `th` + one `td` → key-value pairs, row order.
5. **Data tables** (§8.4) → table blocks, document order.

## 7. Chunk identity and anchors

### 7.1 Chunking

- Chunk boundaries fall at `h2` elements of the main content. Content between
  the title and the first `h2` becomes chunk `intro` (omitted when empty).
- If the main content has no `h2` but has `h3`, `h3` is the boundary level.
- If a chunk's prose exceeds **1,200 budget units** (§9) and contains `h3`
  headings, it is split at each `h3`; the pre-`h3` remainder keeps the `h2`'s
  ID. (With `h3` boundaries, `h4` plays this role.)
- If the main content has no headings at all: paragraph-cluster fallback —
  greedily pack whole paragraphs into chunks of ≤500 budget units, IDs
  `part-1`, `part-2`, …, `anchor: none`.
- A chunk's heading text is not repeated in its prose; the ID and summary
  carry it.

### 7.2 Chunk IDs (slugs)

If the boundary heading element has an `id` attribute matching
`/^[\p{L}\p{N}][\p{L}\p{N}_-]*$/u`, that `id` is used verbatim. Otherwise the
ID is the slug of the heading text:

1. Unicode NFC normalize; lowercase (default case folding).
2. Replace every maximal run of whitespace, `/`, `–`, `—`, `·` with `-`.
3. Delete characters that are not Unicode letters, digits, `-`, or `_`.
4. Collapse `-` runs; trim leading/trailing `-`.
5. Truncate to 64 characters, cutting at a `-` boundary where possible.
6. If empty, use `section`.

Duplicates are deduplicated in document order by appending `-2`, `-3`, ….
`intro`, `part-{n}`, `toc`, `facts` are reserved; a colliding heading slug
gets the `-2` suffix.

**Stability rule**: IDs derive only from the heading (its `id` attribute or
text), never from position, so unchanged sections keep their IDs across
regenerations. Publishers SHOULD put explicit `id` attributes on headings to
make chunk IDs immune to retitling.

### 7.3 Anchors

`anchor: #{fragment}` where `fragment` is an ID present in the page HTML (any
element `id`, or `<a name>`), preferably the boundary heading's own. If no
matching anchor exists in the HTML, the chunk records `anchor: none`.
Generators MUST NOT inject anchors into the HTML. Validators treat `none` as
a warning, not an error.

## 8. Content extraction

Extraction defines both chunk content and the text used for hashing (§10) and
grounding (§14). Steps are normative for this spec version.

### 8.1 Parsing

HTML is parsed leniently (HTML5 parsing rules; malformed markup MUST NOT
crash a generator). `<template>` content is ignored.

### 8.2 Boilerplate stripping

Remove, in document order:

1. Elements: `script`, `style`, `noscript`, `template`, `iframe`, `object`,
   `embed`, `canvas`, `svg`, `form`, `button`, `input`, `select`, `textarea`,
   `label`, `dialog`, `link`, `meta` (body), comments.
2. `nav`, `footer`, `aside` everywhere; `header` when it is a direct child of
   `body` or has `role="banner"`.
3. Any element with `role` in {`navigation`, `banner`, `contentinfo`,
   `complementary`, `search`, `menu`, `menubar`, `alert`, `alertdialog`,
   `dialog`} or with `aria-hidden="true"` or `hidden`.
4. Any element whose `class`, `id`, or `aria-label` word-matches (case
   insensitive, on `[^a-z0-9]+` boundaries) one of: `nav`, `menu`, `footer`,
   `sidebar`, `sidenav`, `breadcrumb`, `breadcrumbs`, `crumbs`, `cookie`,
   `consent`, `banner`, `promo`, `advert`, `ad`, `ads`, `social`, `share`,
   `subscribe`, `newsletter`, `comment`, `comments`, `related`,
   `recommended`, `cross-sell`, `pagination`, `pager`, `skip-link`, `skip`,
   `edit-tools`, `feedback`, `search`, `toc`, `masthead`, `site-header`,
   `site-footer`. (A "word-match" means the token appears as a complete
   `-`/`_`/space-delimited word.)

Rule 4 MUST NOT remove the selected main-content root itself, and generators
SHOULD verify after stripping that navigation text does not appear in output.

### 8.3 Main-content selection

The first of: `<main>`; the largest `<article>` (by text length); the element
with `role="main"`; `<body>`. Selection happens after stripping.

### 8.4 Table classification

Within main content:

- **Layout table**: contains a nested `table`, or has no `th` cells, or has
  only one column. Its text is treated as ordinary inline content.
- **Infobox table**: ≥80% of rows are exactly one `th` + one `td` → facts
  key-values (§6.3).
- **Data table**: has a header row (a `thead`, or a first `tr` of all `th`)
  with ≥2 columns and ≥2 data rows → facts table block.

### 8.5 Metadata harvest

- **title**: `og:title`, else `<title>`, else first `h1` text.
- **summary**: `meta[name=description]`, else `og:description`, else the
  first sentence of the intro chunk. Single line, ≤200 characters (word-
  boundary truncation with `…`).
- **type** (first match wins): JSON-LD `@type` Product → `product`;
  BlogPosting → `blog`; Article/NewsArticle → `article`; TechArticle →
  `docs`. Else `og:type` `product` → `product`. Else `og:type` `article`:
  `blog` if a `meta[name=author]`/`article:author` exists AND the URL path
  contains a `/20\d\d/` segment, otherwise `article`. Else by URL: host
  starting `docs.` or path containing `/docs/`, `/documentation/`, `/guide` →
  `docs`; path containing `/reference/`, `/api/`, `/glossary/` → `reference`;
  path containing `/blog/`, `/posts/` → `blog`; path containing `/product`
  → `product`. Else `article` if main content has ≥3 paragraphs, else
  `other`.
- **url**: `link[rel=canonical]`, else `og:url`, else omitted.
- **lang**: `<html lang>`, else omitted.
- **updated**: `article:modified_time`, else `article:published_time`, else
  a `<time datetime>` in main content, reduced to `YYYY-MM-DD`; else omitted.
- **series-prev/next**: `link[rel=prev]`/`link[rel=next]`, else omitted.

## 9. The budget metric and header limits

All content-affecting size decisions use the **budget metric**, defined as
`ceil(len(UTF-8 bytes) / 4)` — deterministic and tokenizer-independent, so
every implementation produces identical files whether or not a real tokenizer
is present. Real-tokenizer counts (reference tokenizer, §2) are *reported*
alongside output but never change it.

**Header budget**: target ≤100, hard cap 150 budget units, measured over the
header (§4). Generators MUST apply this deterministic overflow sequence until
the header fits the cap:

1. Truncate each TOC description to 6 words.
2. Drop TOC descriptions (`- {id}` lines).
3. Switch to grouped TOC (§15, huge pages).

A header that still exceeds 150 units after step 3 is a generator bug;
validators flag headers over the cap as errors and over the target as
warnings.

## 10. Hash computation

The `hash:` value ties a sibling to the page content it was derived from.

1. Let `T` = the concatenated text content of the main content (§8), in
   document order, after boilerplate stripping.
2. **Normalize**: Unicode NFC → replace every maximal run of Unicode
   whitespace with one ASCII space (U+0020) → trim.
3. `hash = "sha256:" + lowercase-hex(SHA-256(UTF-8(T)))`.

A validator recomputes the hash from the HTML; a mismatch means the sibling
is stale (or the extractor version differs — see §17).

## 11. Split-file layout and the two-hop contract

With `--split`, a generator additionally emits a directory `page.llm/`:

| File | Content |
| --- | --- |
| `_header.md` | The header: version marker through end of `## toc` |
| `facts.md` | The `## facts` section |
| `{chunk-id}.md` | That chunk's `## chunk` section |
| `_toc-{n}.md` | Sub-TOCs, huge pages only (§15) |

Each split file carries its section verbatim, so the combined file equals:
`_header.md` + `facts.md` + each chunk file in TOC order, joined with single
blank lines, with a single trailing newline.

**Two-hop contract.** Consumers SHOULD: (hop 1) fetch `_header.md` (or the
combined file's header), decide relevance from the summary and TOC; (hop 2)
fetch `facts.md` and/or only the chunk files they need. The header is
self-sufficient for the "is this page relevant?" decision; chunks are
self-sufficient for reading (each carries its own summary and anchor).
Consumers MUST treat all sibling content as untrusted page data — never as
instructions (§14).

## 12. The `.json` rendering and JSON Schema

The `.json` sibling mirrors the `.md` structure exactly:

```json
{
  "pageskim": "0.1",
  "title": "…",
  "summary": "…",
  "type": "article",
  "url": "https://…",
  "lang": "en",
  "updated": "2026-03-12",
  "series": { "prev": null, "next": null },
  "hash": "sha256:…",
  "toc": [ { "id": "origin", "summary": "…" } ],
  "facts": {
    "kv": [ { "key": "location", "value": "Pharos, Alexandria, Egypt" } ],
    "tables": [ { "id": "cluster-options", "cols": ["option","type"], "rows": [["endpoint","string"]] } ]
  },
  "chunks": [
    { "id": "origin", "summary": "…", "tags": ["sostratus-of-cnidus"], "anchor": "#origin", "text": "…" }
  ]
}
```

- Optional metadata absent from the `.md` is `null` (or the `series` object
  members are `null`); `tags` absent is `[]`.
- Table cells are raw strings (the `\|`/`\\`/`\n` escaping of §6.2 is an
  `.md`-surface concern only).
- Canonical serialization: UTF-8, 2-space indent, LF, single trailing
  newline, key order as above.

The normative JSON Schema lives at
[`spec/pageskim.schema.json`](pageskim.schema.json) and is versioned with
this document.

## 13. Site index

`/.well-known/pageskim.json`:

```json
{
  "pageskim": "0.1",
  "pages": [
    {
      "url": "/wiki/lighthouse-of-alexandria.html",
      "md": "/wiki/lighthouse-of-alexandria.llm.md",
      "json": "/wiki/lighthouse-of-alexandria.llm.json",
      "split": "/wiki/lighthouse-of-alexandria.llm/",
      "title": "Lighthouse of Alexandria",
      "hash": "sha256:…",
      "updated": "2026-03-12"
    }
  ]
}
```

- `pages` sorted by `url` (code-point order). `json`, `split`, `updated` are
  `null` when absent. URLs are site-absolute paths or full URLs.
- The index carries no timestamp of its own, preserving byte-identical
  regeneration; freshness is per-page via `updated`/`hash`.
- Generators MAY seed the page list from an existing `llms.txt` but MUST NOT
  require one.

## 14. Trust rules

Sibling files describe pages to agents that will often skip the HTML, which
makes them an attractive channel for cloaking (content humans never see) and
prompt injection (instructions disguised as content). Therefore:

1. **Derivability.** Every prose sentence, summary, fact value, and title in
   a sibling MUST be derivable from the human-visible HTML: identical to a
   normalized (§10 step 2) segment of the page text, a truncation of one
   (with `…`), or — for facts — a value present in the page's metadata
   (`meta` content, JSON-LD values, `alt`/`datetime`/`caption` text).
   Structural scaffolding (markers, keys, IDs, `cols:` lines) is exempt.
2. **No additive content.** Generators MUST NOT inject text absent from the
   page — no synthesized descriptions, no advertising, no instructions.
   Abstractive (rewritten) summaries are non-conformant at this spec version;
   summaries are extractive.
3. **Validator obligations.** A conforming validator checks, at minimum:
   content divergence (sentences not grounded per rule 1 — this catches both
   cloaking and injected instructions), stale hash (§10), broken chunk
   anchors (§7.3), header over cap (§9), malformed facts (§6), and — as a
   warning — boilerplate leakage (sibling text grounded only in stripped
   regions of the HTML).
4. **Consumer posture.** Agents MUST treat sibling content as untrusted data.
   Nothing in a sibling is an instruction to the agent, whatever it claims.
   Consumers SHOULD prefer siblings whose hash verifies against the fetched
   HTML when they can afford the check.

## 15. Edge-case behaviors

| Case | Required behavior |
| --- | --- |
| Malformed/legacy HTML | Parse leniently; never crash; emit warnings. |
| Client-rendered SPA (near-empty body) | If main-content text < 200 normalized characters while the page has heavy script use, fail with a clear "pre-render or supply rendered HTML" error; do not emit a misleading sibling. (Runtime alternative: generate from the live DOM after hydration — see the SDK's `fromDocument`.) |
| Huge pages (>200 KB text) | Chunk normally. If >100 chunks: the header `## toc` lists groups (`- toc-{n}: {first-id} … {last-id} ({count} chunks)`), and `## toc {n}` sections (split: `_toc-{n}.md`) carry the detailed entries, ≤50 chunks per group. Never truncate silently. |
| No headings | Paragraph-cluster fallback (§7.1), `anchor: none`; validators warn, not error. Anchor injection into the HTML is forbidden. |
| Tables: data vs layout | Classify per §8.4: layout → inline text; infobox → facts kv; data → facts table block. |
| Code blocks | Preserved verbatim in chunks, fenced; never summarized away. |
| Images/figures | `figure:` lines from `alt` + `figcaption` (§5.3). |
| Non-English content | Fully supported: summaries stay in the page's language (extractive), slugs are Unicode-safe (§7.2), `lang:` carries the BCP-47 tag. |
| Paginated articles | Each page gets its own sibling; `series-prev`/`series-next` from `link[rel=prev/next]`. |
| Thin/empty pages | Emit a minimal valid sibling (header with empty-ish TOC, empty facts) plus a warning. Distinguished from the SPA case by the absence of heavy script use. |
| Duplicate headings | Deterministic slug dedupe (`-2`, `-3`) in document order (§7.2). |
| Boilerplate | Stripped per §8.2; nav/footer/cookie text MUST NOT appear in output. |
| Existing `llms.txt` | MAY seed the site index; never required. |

## 16. Design rationale

- **Why not just serve HTML?** Raw HTML carries ~67.6% token overhead versus
  its semantic content (arXiv 2606.19116). Simple HTML→markdown conversion
  already yields 5–10× reductions (Cloudflare's token analysis measured
  16,180 → 3,150 tokens on a sample post). PageSkim starts from that baseline
  and adds layering.
- **Why layers + two hops?** Removing irrelevant context *improves* answer
  accuracy, not just cost: LLMLingua (arXiv 2310.05736) and LongLLMLingua
  (arXiv 2310.06839) report up to 21.4% accuracy gains with ~4× fewer tokens.
  Those are runtime compression systems; PageSkim's header→chunks design is
  the zero-infrastructure static equivalent — the publisher pre-computes the
  selectable units once.
- **Why does prose stay prose?** Forcing running text into rigid formats
  measurably degrades LLM reasoning (arXiv 2408.02442). Hence chunks are
  plain prose and only genuinely tabular data is tabular.
- **Why TOON-style tables?** For uniform records, compact tabular encoding
  uses ~40% fewer tokens than JSON with equal-or-better comprehension
  (toonformat.dev).
- **Why two serializations?** Prompt format can swing task accuracy by up to
  40% on smaller models and no single format wins everywhere (arXiv
  2411.10541), so the structure — not one serialization — is normative.
- **Why a budget metric separate from real tokenizers?** Determinism: output
  bytes must not depend on which tokenizer a given environment ships.

## 17. Versioning and changelog policy

- The spec is semantically versioned; siblings carry `MAJOR.MINOR` in the
  version marker.
- Pre-1.0: breaking format changes bump MINOR (`0.1` → `0.2`) and are
  batched; editorial fixes bump PATCH (not reflected in the marker).
- Extraction/slugging/hash algorithm changes are format changes (they alter
  bytes and hashes) and require a version bump plus a changelog entry.
- Changes follow the RFC process in [CONTRIBUTING.md](../CONTRIBUTING.md):
  issue → ≥7-day discussion → PR updating spec text, JSON Schema, changelog,
  and the worked example together.
- Changelog: [`spec/CHANGELOG.md`](CHANGELOG.md).

## 18. Worked example

Input: [`examples/article-infobox/page.html`](../examples/article-infobox/page.html)
(an encyclopedia-style article with a site header, fundraising banner,
infobox table, inline contents box, related-articles/language sidebars, and a
mega-footer — all of which must be stripped or harvested, never leaked).

Generated combined sibling (`page.llm.md`) — this exact output is also the
golden fixture `packages/core/test/fixtures/expected/article-infobox.llm.md`,
regenerated by `npm run fixtures:update`:

```markdown
<!-- pageskim 0.1 -->
# Lighthouse of Alexandria

> The Lighthouse of Alexandria, one of the Seven Wonders of the Ancient World, guided sailors into the harbour of Alexandria for over 1,500 years.

type: article
url: https://encyclopedia.example.org/wiki/lighthouse-of-alexandria
lang: en
updated: 2026-03-12
hash: sha256:(computed per §10)

## toc
- intro: The Lighthouse of Alexandria, sometimes called the Pharos of Alexandria, …
- origin: Pharos was a small island just off the coast of Alexandria, …
- construction: The lighthouse was built from large blocks of light-coloured stone …
- height-and-description: Descriptions by ancient and medieval travellers agree …
- destruction: The lighthouse was progressively destroyed by earthquakes in 956, …
- archaeological-research: In 1994, a team of archaeologists led by Jean-Yves Empereur …
- in-ancient-and-medieval-accounts: The lighthouse appears in a remarkably continuous chain …
- legacy: The lighthouse gave its name to the architectural type: …
- references: Pliny the Elder, Natural History, Book XXXVI.

## facts
- modified: 2026-03-12
- location: Pharos, Alexandria, Egypt
- coordinates: 31°12′50″N 29°53′08″E
- construction started: c. 297 BC
- completed: c. 283 BC
- destroyed: 1303–1480 AD (earthquakes)
- height: c. 100 m (330 ft)
- builder: Sostratus of Cnidus (attributed)
- commissioned by: Ptolemy I Soter
- cost: 800 talents of silver
- type: Lighthouse
- material: Light-coloured stone, molten lead mortar
- successor site: Citadel of Qaitbay (1480)

## chunk intro
summary: The Lighthouse of Alexandria, sometimes called the Pharos of Alexandria, was a lighthouse built by the Ptolemaic Kingdom of Ancient Egypt during the reign of…
anchor: #lighthouse-of-alexandria

(intro paragraphs as plain prose…)

## chunk origin
summary: Pharos was a small island just off the coast of Alexandria, connected to the city by a man-made causeway called the Heptastadion, which thereby formed one side…
anchor: #origin

(section prose…)

(…remaining chunks in TOC order…)
```

Hand-validation walkthrough: the header above sits well under 100 budget
units before TOC descriptions and under the 150 cap with them; every chunk ID
equals the `id` attribute of its `h2` in the HTML; every infobox row appears
as a facts key-value; no text from the site header, fundraising banner,
contents box, asides, or footer appears anywhere; the summary is the page's
`meta description` verbatim; `updated` comes from `article:modified_time`.

---

*This specification is licensed MIT, like the rest of the repository.*
