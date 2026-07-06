# Launch checklist & announcement draft

## Pre-launch checklist

### Names & accounts
- [x] Publish the repo — done: [`venki0552/PageSkim`](https://github.com/venki0552/PageSkim) (2026-07-05). All in-repo URLs point there; if it later moves to a `pageskim` org, GitHub redirects old links but re-run the URL sweep anyway.
- [ ] Claim npm: publish `pageskim`, `@pageskim/core`, `@pageskim/generator`, `@pageskim/validator` (dry-runs pass; `npm publish --access public` per package, core first).
- [ ] Register `pageskim.dev` (free as of 2026-07-04); point at the playground.
- [ ] Quick USPTO/EUIPO trademark search for "pageskim".

### Repo polish
- [ ] Record the hero GIF: playground converting Wikipedia's Lighthouse of Alexandria (142,687 → 7,625 → 165 tokens); save as `docs/hero.gif`, un-comment the README slot.
- [ ] Replace `github.com/venki0552/PageSkim` placeholder URLs if the org name changes (README, About page, SDK README, UA string in `apps/playground/src/app/api/convert/route.ts`, `bench/pageskim_bench/wikipedia.py`).
- [ ] Run the real benchmark (`--provider anthropic --articles 10`, needs `ANTHROPIC_API_KEY`; ~$1–5) and replace the proxy numbers in README + About page with real ones. Commit `bench/results/results.json`.
- [ ] Tag `v0.1.0`; spec CHANGELOG entry finalized (done).

### Vercel deploy
- [ ] Import repo → root directory `apps/playground` → framework Next.js.
- [ ] Optional: add Vercel KV, set `KV_REST_API_URL` + `KV_REST_API_TOKEN` (aggregate counter persists; otherwise in-memory fallback works).
- [ ] Smoke test: `/` converts an example; URL mode on a Wikipedia page; `/api/convert` via curl; `/about` renders; dark mode toggle.
- [ ] Set the production URL in the README "Playground API" section and the Deploy button URL.

### npm publish order
1. `@pageskim/core` → 2. `@pageskim/generator` + `@pageskim/validator` → 3. `pageskim`.
Then verify: `npx pageskim@0.1.0 generate --help` and the unpkg script tag on `packages/sdk/fixtures/demo.html`.

## Announcement draft

**Title:** PageSkim — give every page on your site a 10–50x cheaper twin for LLMs and agents (static files, no servers)

Agents read the web through a token meter. A single Wikipedia article costs ~142k tokens as raw HTML; the same content as a PageSkim sibling is 7.6k — and an agent deciding *whether* to read it needs only the 165-token header.

**The problem.** Raw HTML is mostly boilerplate for a model: nav, scripts, consent banners, SVG sprites. Two thirds of what agents pay for isn't content — and irrelevant context doesn't just cost money, it measurably lowers answer accuracy (LLMLingua, arXiv 2310.05736).

**The design.** For every `page.html`, publish `page.llm.md` with three layers: a ≤100-token **header** (identity + a table of contents of chunk IDs), **facts** (the page's verifiable data, compactly encoded), and **chunks** (each section as plain prose, anchored back to the human page). Agents fetch the header first, then only the chunks they need — two hops, zero infrastructure. Prose stays prose (structuring it hurts reasoning — arXiv 2408.02442); only genuinely tabular data is tabular.

**Trust is part of the format.** Sibling content must be derivable from the human-visible HTML. `pageskim validate` recomputes the content hash and greps every sentence against the page — cloaked content, injected prompt-instructions, and stale siblings fail CI.

**Numbers.** [Real-model benchmark table + link to PROTOCOL.md — insert after the real run.] Pre-registered protocol, 4 conditions, disk-cached, reproducible.

**Try it.** Playground (paste any HTML or URL, watch the counter, run the two-hop simulator — no API keys): [link]. Make your site agent-readable in one line: `npx pageskim generate ./dist --site-index`. Spec, SDK, GitHub Action, benchmark harness: [repo link].

MIT licensed. Spec changes go through a public RFC process — implementers welcome.

## Where to share

- llms-txt GitHub discussions (the closest prior art — position as the "per-page content layer" complement to llms.txt's site index).
- Hacker News (Show HN: the playground link, not the repo — the counter is the hook).
- r/LocalLLaMA (angle: your local agent's context window is small; two-hop makes real-web RAG fit).
- W3C Web Machine Learning CG (spec/RFC angle).
- The arXiv authors cited in the Design Rationale (courtesy note).
- Vercel templates gallery (the playground is a one-click deploy).
