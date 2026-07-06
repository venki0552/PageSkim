# PageSkim benchmark harness

Measures, per question, four conditions — **raw HTML**, **plain markdown**,
**llms.txt-style index**, and **PageSkim two-hop** — reporting LLM-judged
accuracy, input/output tokens, tokens-per-correct-answer, and $ per correct
answer. 3 runs per condition, mean ± 95% CI, every API call disk-cached.
The design is pre-registered in [PROTOCOL.md](PROTOCOL.md).

## Setup & smoke test (no API key)

```bash
python3.11 -m venv .venv
.venv/bin/pip install -e ".[dev]"
.venv/bin/pytest                                   # offline tests
.venv/bin/python -m pageskim_bench.run --provider fake --articles 2
```

The `fake` provider is a deterministic lexical proxy — it validates the whole
pipeline (fetch → sibling generation → conditions → judging → aggregation)
offline. Its numbers are **pipeline validation only**; label them as such.

Sibling generation shells out to the repo's node CLI — run `npm run build` at
the repo root first (or pass `--siblings-dir` with pre-generated files).

## Real runs

```bash
.venv/bin/pip install -e ".[anthropic]"
export ANTHROPIC_API_KEY=…                          # or `ant auth login`
.venv/bin/python -m pageskim_bench.run --provider anthropic --articles 10
```

Outputs land in `results/`: `results.csv` (per-trial), `results.json`
(aggregate + per-article breakdown; the playground About page can embed it),
`report.md` (the headline table).

## Growing the evidence — how to add more data

The single blended number is the least interesting output; decision-useful
results come from **coverage**. Levers, cheapest first:

1. **More articles.** `--articles 30` uses the full committed list in
   [data/titles.txt](data/titles.txt) (grouped by page shape: monuments,
   biographies, science, events, organizations, places). The first 10 are
   the pre-registered set — keep reporting them separately for comparability.
2. **Your own corpus.** `--titles-file my-titles.txt` (one Wikipedia title
   per line). To benchmark *non-Wikipedia* pages, generate siblings for them
   (`npx pageskim generate`) and pass `--siblings-dir`.
3. **Harder questions.** `--external-jsonl questions.jsonl` merges questions
   in the form `{"question": …, "answer": …, "title": …}` — the intended
   path for Natural Questions / HotpotQA subsets filtered to your articles.
   Infobox templates test fact lookup; external sets add paraphrase and
   multi-sentence reasoning, where the "prose stays prose" design earns its
   keep.
4. **More models.** The provider string is the axis:

   ```bash
   for m in claude-haiku-4-5 claude-sonnet-4-6 claude-opus-4-8; do
     .venv/bin/python -m pageskim_bench.run --provider "anthropic:$m" --articles 10
     cp results/results.json "results/results-$m.json"
   done
   ```

   A cross-tier table ("two-hop + Haiku beats raw-HTML + Sonnet at 1/60th
   the cost" — if it holds) is the most decision-relevant result this
   harness can produce. Runs are cheap to repeat: the cache never re-asks
   an identical request.

Everything is cached by request hash, so growing a run re-uses all prior
calls — an interrupted run resumes for free.

### Contributing results

PRs adding `results/results-<model>-<date>.json` are welcome if they state:
provider/model, article count, question source, harness commit, and total
cost. Runs that contradict our headline numbers are *especially* welcome —
that's what the pre-registered protocol is for.

### Roadmap (not yet implemented)

- Page-shape diversity beyond Wikipedia (docs sites, product pages, news) —
  the generator handles them; the blocker is gold-answer sourcing.
- Negative questions ("answer is not on this page") to measure hallucination
  under each condition.
- Non-English articles (the format is Unicode-safe end to end; untested at
  benchmark scale).
- Answer-position sensitivity (does two-hop help more when the fact is deep
  in the page?).
