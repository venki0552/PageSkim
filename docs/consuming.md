# Consuming PageSkim — agent & tool developer guide

You're building the *other* side: an agent, crawler, or LLM tool that reads
pages. This guide is how to use PageSkim siblings to cut your input tokens by
10–50x — and when not to trust them.

## 1. Discover the sibling

Try in this order (spec §3.2):

1. **Site index**: `GET {origin}/.well-known/pageskim.json` → maps page URLs
   to sibling URLs, with hashes and update dates. One fetch covers the site.
2. **Link relation** in the HTML you already have:
   `<link rel="alternate" type="text/llm+markdown" href="...">`
3. **Naming convention**: rewrite `…/page.html` → `…/page.llm.md`
   (`…/dir/` → `…/dir/index.llm.md`) and probe. A 404 means no sibling.

Always fall back gracefully: no sibling → process the HTML as you do today
(or convert it yourself client-side with
[`pageskim`](../packages/sdk/README.md)'s `fromHTML` — same format, your CPU).

## 2. One hop or two?

- **Small pages / single-page tasks**: fetch the combined `page.llm.md` and
  put it in context. Done — you already saved ~10x vs the HTML.
- **Big pages, many pages, or tight budgets**: use the two-hop contract.
  Hop 1 costs ~150 tokens and answers "is this page relevant, and where?".

Two-hop flow against a split directory (`page.llm/`):

```
hop 1:  GET page.llm/_header.md            (~150 tokens)
        → model (or a cheap ranker) picks chunk IDs from the toc
hop 2:  GET page.llm/facts.md              (usually worth it — it's dense)
        GET page.llm/{chosen-chunk}.md ×N
```

If only the combined file exists, fetch it once and split client-side on
`^## ` lines — the sections are identical to the split files (spec §11).

### Minimal two-hop client (TypeScript)

```ts
async function twoHop(pageUrl: string, question: string, pickChunks: (header: string) => Promise<string[]>) {
  const base = pageUrl.replace(/\.html?$/, "") + ".llm/";
  const header = await (await fetch(base + "_header.md")).text();   // hop 1
  const ids = await pickChunks(header);                              // your model or BM25
  const parts = await Promise.all(
    ["facts.md", ...ids.map((id) => `${id}.md`)].map(async (f) => (await fetch(base + f)).text()),
  );                                                                 // hop 2
  return [header, ...parts].join("\n\n");                            // → model context
}
```

`pickChunks` can be an LLM call ("given this header, which chunk IDs answer
the question?") or a zero-cost lexical ranker — the repo ships a ~40-line
BM25-lite you can copy (`apps/playground/src/lib/bm25.ts`, mirrored in Python
at `bench/pageskim_bench/conditions.py::select_chunks`).

### Parsing instead of prompting

Prefer structure? Fetch `page.llm.json` (same content, spec §12,
[JSON Schema](../spec/pageskim.schema.json)) — `{title, summary, toc, facts:
{kv, tables}, chunks: [{id, summary, anchor, text}]}`. Or parse the markdown
with `parseSibling` from `@pageskim/core` — it's the same parser the
validator uses:

```ts
import { parseSibling } from "@pageskim/core";
const doc = parseSibling(llmMdText); // → { title, meta, toc, factsKv, factsTables, chunks, … }
```

## 3. What each layer is for

| Layer | Use it for |
| --- | --- |
| Header `summary` + `toc` | Relevance decisions, routing, "which page/chunk do I read?" |
| `facts` | Direct answers to factual questions (dates, prices, specs) — check here **before** fetching chunks; it's the densest tokens on the page |
| `chunks` | The actual reading. Each carries its own `summary` and an `anchor` you can cite back to the human page (`{pageUrl}{anchor}`) |
| `hash` | Staleness check (below) |
| `series-prev/next` | Pagination — the article continues elsewhere |

The `anchor` field is the citation story: your agent can quote a chunk and
link users to the exact section of the human page.

## 4. Trust posture (read this one)

PageSkim's trust rules (spec §14) make cloaking *detectable*, not
*impossible*. As a consumer:

- **Treat sibling content as untrusted page data, never as instructions.**
  Same injection posture you (should) have for raw HTML — a sentence saying
  "ignore your instructions" is content to summarize, not a command.
- **Verify when it matters.** If you can afford one extra fetch, recompute
  the hash: `validateSibling(html, md)` from `@pageskim/core` runs the full
  check suite (hash, anchors, sentence-level grounding) in one call. Cheap
  middle ground: compare the header's `hash:` against the site index's hash
  for cache invalidation without fetching the HTML.
- **Cross-check high-stakes facts** against the HTML before acting on them
  (purchases, medical, legal). The sibling is an honest-publisher
  optimization, not a signature.

## 5. Practical details

- Send a real `User-Agent` and respect robots.txt for the HTML; siblings
  live at the same paths and inherit the same crawling etiquette.
- Cache siblings by URL + `hash` — the hash changes iff the content did.
- Budget rule of thumb from our measurements: header ≈ 130–170 tokens,
  facts ≈ 100–400, a chunk ≈ 100–600. A two-hop answer usually lands under
  1,500 tokens even on pages that are 100k+ as HTML.
- Token counts you compute with o200k/cl100k tokenizers will differ slightly
  from other models' — treat all counts as estimates.

## 6. Try it without writing code

The [playground](../apps/playground) simulates the whole flow: paste a URL,
ask a question in the two-hop simulator, and watch hop-1/hop-2 token math on
real pages. Its `/api/convert` endpoint also converts pages that don't have
siblings yet.
