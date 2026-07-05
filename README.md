# AgentPage

> **Status: early scaffold (pre-0.1).** The format spec, generator, validator, SDK, playground, and benchmarks are being built phase by phase. Nothing is published to npm yet.

**AgentPage** is an open-source format + tooling that makes any website readable by LLMs and agents at **10–50x fewer tokens** than raw HTML — using only **static files**. No servers, no RAG pipelines, no vector databases required by adopters.

## The idea in 30 seconds

For every `page.html`, you publish a sibling `page.llm.md` (and optionally an equivalent `page.llm.json`) with exactly three layers:

1. **HEADER** (≤100 tokens) — title, one-line summary, page type, canonical URL, last-updated date, content hash, and a table of contents listing every chunk ID with a one-line description.
2. **FACTS** — key verifiable data (dates, numbers, names, prices) in a compact tabular encoding for uniform data, `key: value` lines otherwise.
3. **CHUNKS** — each content section as plain prose, with a stable ID that matches an anchor in the human HTML.

Agents use a **two-hop retrieval contract**: fetch the tiny header first, pick the chunk IDs they need, then fetch only those chunks. A whole site becomes agent-navigable for a fraction of the token cost — and answers get *more* accurate, because irrelevant context is gone before the model ever sees it.

Sibling content must be derivable from the human-visible HTML — a validator enforces this (anti-cloaking, anti-prompt-injection).

## Repository layout

| Path | What it is |
| --- | --- |
| [`spec/SPEC.md`](spec/SPEC.md) | Format spec v0.1 (Phase 1) |
| [`packages/core`](packages/core) | Pure, isomorphic TS library: parse → extract → emit. Single source of truth for conversion logic |
| [`packages/generator`](packages/generator) | CLI: `agentpage generate` |
| [`packages/validator`](packages/validator) | CLI: `agentpage validate` |
| [`packages/sdk`](packages/sdk) | Browser SDK (ESM + UMD) for any web page — no framework required |
| [`apps/playground`](apps/playground) | Hosted playground with live token-savings counter (Next.js, Vercel) |
| [`bench/`](bench) | Python benchmark harness (accuracy + tokens-per-correct-answer across formats) |
| [`skills/agentpage`](skills/agentpage) | AI-assistant skill: "make my site agent-readable" |
| [`examples/`](examples) | Sample pages: article+infobox, docs, blog, product |

## Development

```bash
npm install       # installs all workspaces
npm test          # vitest across packages
npm run lint      # eslint
npm run build     # tsc across packages

# Python benchmark harness (Phase 5)
python3.11 -m venv bench/.venv
bench/.venv/bin/pip install -e "bench[dev]"
bench/.venv/bin/pytest bench
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full dev guide and the spec-change RFC process.

## Design rationale (evidence base)

- Raw HTML carries ~67.6% token overhead vs. semantic content ([arXiv 2606.19116](https://arxiv.org/abs/2606.19116)); HTML→markdown alone yields 5–10x reductions (Cloudflare token analysis: 16,180 → 3,150 tokens on a sample post).
- Prompt format can swing accuracy by up to 40% on smaller models; there is no universal best format ([arXiv 2411.10541](https://arxiv.org/abs/2411.10541)) — hence AgentPage is serialization-flexible (`.md` and `.json` are equivalent renderings).
- TOON-style tabular encoding uses ~40% fewer tokens than JSON at equal-or-better comprehension for uniform arrays ([toonformat.dev](https://toonformat.dev)).
- Removing irrelevant context *improves* accuracy, not just cost ([LLMLingua, arXiv 2310.05736](https://arxiv.org/abs/2310.05736); [LongLLMLingua, arXiv 2310.06839](https://arxiv.org/abs/2310.06839) — up to 21.4% gains with ~4x fewer tokens). AgentPage's layered two-hop design is the zero-infrastructure static equivalent.
- Structuring prose into key-value formats hurts reasoning ([arXiv 2408.02442](https://arxiv.org/abs/2408.02442)) — hence prose stays prose in chunks.

Token counts reported by the tooling are estimated (cl100k/o200k base); exact counts vary by model tokenizer.

## License

[MIT](LICENSE)
