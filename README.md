# PageSkim

[![CI](https://img.shields.io/github/actions/workflow/status/pageskim/pageskim/ci.yml?label=CI)](https://github.com/pageskim/pageskim/actions)
[![npm](https://img.shields.io/badge/npm-pageskim%400.1.0-blue)](https://www.npmjs.com/package/pageskim)
[![spec](https://img.shields.io/badge/spec-v0.1-8a2be2)](spec/SPEC.md)
[![license](https://img.shields.io/badge/license-MIT-green)](LICENSE)

**Make any website readable by LLMs and agents at 10–50x fewer tokens — with static files only.** No servers, no RAG pipeline, no vector database. For every `page.html`, PageSkim emits a compact sibling `page.llm.md` that agents fetch instead of the raw page.

<!-- TODO(launch): hero GIF — record the playground converting the Wikipedia
     Lighthouse of Alexandria page (142,687 → 7,625 → 165 tokens) and drop it
     here as docs/hero.gif. -->

**Real page, real numbers** — Wikipedia's *Lighthouse of Alexandria*:

| | tokens | vs raw |
| --- | ---: | ---: |
| Raw HTML | 142,687 | — |
| PageSkim sibling (`.llm.md`) | 7,625 | **18.7x smaller** |
| Header only (hop 1 of 2) | 165 | **865x smaller** |

## Quickstart

```bash
npx pageskim generate ./site --json --split --site-index --base-url https://example.com
npx pageskim validate ./site/page.html ./site/page.llm.md
```

That's the whole deployment: static files next to your pages, plus `/.well-known/pageskim.json` so agents can discover them. Framework recipes (Next.js, Astro, Hugo, Jekyll): [docs/adapters.md](docs/adapters.md). One-tag browser usage:

```html
<script src="https://unpkg.com/pageskim/dist/pageskim.min.js"></script>
<pageskim-badge></pageskim-badge>
```

## How it works

Every sibling has exactly three layers ([spec v0.1](spec/SPEC.md)):

1. **HEADER** — title, one-line summary, page type, canonical URL, content hash, and a TOC of chunk IDs. Target ≤100 tokens.
2. **FACTS** — the page's verifiable data (dates, numbers, prices, infobox rows) as `key: value` lines and compact TOON-style tables.
3. **CHUNKS** — each section as **plain prose** with a stable ID matching an anchor in the human HTML.

Agents use the **two-hop contract**: fetch the tiny header, pick chunk IDs, fetch only those chunks. And it's tamper-evident: sibling content MUST be derivable from the human-visible HTML — `pageskim validate` catches cloaked or injected content, stale hashes, and broken anchors.

## Why this design (evidence)

- Raw HTML carries ~67.6% token overhead vs semantic content ([arXiv 2606.19116](https://arxiv.org/abs/2606.19116)); HTML→markdown alone is a 5–10x cut (Cloudflare: 16,180 → 3,150 tokens).
- Removing irrelevant context **improves accuracy**, not just cost ([LLMLingua](https://arxiv.org/abs/2310.05736), [LongLLMLingua](https://arxiv.org/abs/2310.06839): up to +21.4% with ~4x fewer tokens). Two-hop is the zero-infrastructure static version of that idea.
- Forcing prose into rigid formats hurts reasoning ([arXiv 2408.02442](https://arxiv.org/abs/2408.02442)) — chunks stay prose; only tabular data is tabular (TOON-style: ~40% fewer tokens than JSON, [toonformat.dev](https://toonformat.dev)).
- No single serialization wins everywhere ([arXiv 2411.10541](https://arxiv.org/abs/2411.10541)) — `.md` and `.json` are equivalent renderings.

## Benchmark (pipeline validation)

Four conditions per question over Wikipedia articles with infobox QA, 3 runs each, disk-cached, pre-registered protocol ([bench/PROTOCOL.md](bench/PROTOCOL.md)). Numbers below are from the **offline lexical proxy model** (pipeline validation — real-model results land before launch):

| condition | accuracy | input tokens/trial | tokens per correct |
| --- | --- | ---: | ---: |
| raw HTML | 52.1% | 89,805 | 172,425 |
| plain markdown | 52.1% | 18,025 | 34,607 |
| llms.txt-style index | 4.2% | 164 | 3,930 |
| **PageSkim two-hop** | **58.3%** | **4,446** | **7,622** |

Run it yourself: `python -m pageskim_bench.run --provider anthropic --articles 10`.

## Repository

| Path | What |
| --- | --- |
| [`spec/SPEC.md`](spec/SPEC.md) | Format spec v0.1 + [JSON Schema](spec/pageskim.schema.json) + [changelog](spec/CHANGELOG.md) |
| [`packages/core`](packages/core) | Pure, isomorphic conversion library — the single source of truth |
| [`packages/generator`](packages/generator) / [`validator`](packages/validator) | CLI wrappers |
| [`packages/sdk`](packages/sdk) | `pageskim` on npm: browser SDK (ESM + `<script>`) and umbrella CLI |
| [`apps/playground`](apps/playground) | Hosted playground: token counter, two-hop simulator, free `/api/convert` |
| [`bench/`](bench) | Python benchmark harness (pre-registered protocol) |
| [`skills/pageskim`](skills/pageskim) | AI-assistant skill: "make my site agent-readable" |
| [`.github/action.yml`](.github/action.yml) | GitHub Action: generate + validate in CI |
| [`examples/`](examples) | Sample pages (article, docs, blog, product) |

## Playground API

The playground doubles as a free API:

```bash
curl -X POST https://<playground-host>/api/convert \
  -H "Content-Type: application/json" \
  -d '{"url": "https://en.wikipedia.org/wiki/Lighthouse_of_Alexandria"}'
# → { llmMd, llmJson, splitFiles, tokenReport, warnings, doc }
```

Rate-limited per IP; CORS open; robots.txt respected; nothing stored.

## Development

```bash
npm install && npm test        # packages (vitest; builds first)
npm run lint && npm run build
cd apps/playground && npm run dev

python3.11 -m venv bench/.venv && bench/.venv/bin/pip install -e "bench[dev]"
bench/.venv/bin/pytest bench
```

Token counts everywhere are estimates (o200k_base); exact counts vary by model tokenizer. Contributions welcome — see [CONTRIBUTING.md](CONTRIBUTING.md), including the spec RFC process.

## License

[MIT](LICENSE)
