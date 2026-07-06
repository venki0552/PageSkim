# PageSkim benchmark protocol (pre-registered)

**Status: registered 2026-07-05, before the first full run.** Changes to this
protocol after the first full run will be documented in a "Deviations" section
appended below, never edited in place.

## Hypotheses

- **H1 (cost):** PageSkim two-hop answers questions with ≥5x fewer input
  tokens than raw HTML at equal-or-better accuracy.
- **H2 (accuracy):** PageSkim two-hop accuracy is not worse than raw HTML
  accuracy (removing boilerplate should help, per LLMLingua-style results),
  and tokens-per-correct-answer is strictly better.

## Conditions (within-subject: same question, four contexts)

1. **raw-html** — the page's raw HTML, as fetched.
2. **markdown** — a plain HTML→markdown/text conversion (tags stripped,
   headings marked, boilerplate NOT removed). The "cheap baseline".
3. **llmstxt** — an llms.txt-style digest: title, summary, and the section
   headings (what an agent gets from a link index without fetching content).
4. **pageskim-twohop** — the sibling header (hop 1), then facts + the top-3
   BM25-selected chunks (hop 2). Context = header + facts + selected chunks.

Contexts longer than `--max-context-chars` (default 400,000) are truncated
with an explicit `[truncated]` marker; truncation events are reported.

## Data

- **Articles:** N Wikipedia articles (default N=10; configurable) fetched via
  the REST API (`/api/rest_v1/page/html/{title}`) from a fixed, committed
  title list (`bench/data/titles.txt`), snapshot to disk before any runs.
- **Questions:**
  - *Infobox QA:* deterministic templates over facts harvested from each
    article's infobox: "What is the {key} of {title}?" with the infobox value
    as gold. Up to 8 per article, deterministic selection (first 8 by
    document order).
  - *NQ/HotpotQA:* optional loader for subsets filtered to the fetched
    articles (local JSONL; not fetched by the harness).

## Model & judging

- Answering model: configurable; default Anthropic API `claude-sonnet-4-6`
  (provider-agnostic interface; OpenAI-compatible and local endpoints plug in
  via `--provider`).
- Judge: LLM judge (same provider family, temperature 0) shown question,
  gold, and candidate; verdict CORRECT/INCORRECT. Judge prompt is fixed in
  `judge.py` and versioned with this protocol.
- 3 runs per (question × condition); a per-run nonce is injected so runs are
  distinct requests. Reported: mean ± 95% CI (normal approximation).

## Metrics

- Accuracy (judged).
- Input and output tokens (provider-reported).
- Tokens-per-correct-answer = total input tokens / number correct.
- $ per correct answer (model price table in `run.py`, editable, labeled).

## Caching & reproducibility

- Every provider call (answers and judgments) is disk-cached under
  `bench/.cache/` keyed by the SHA-256 of the full request payload.
- Article HTML snapshots and generated siblings are stored under
  `bench/data/` so a re-run uses identical inputs.
- Outputs: `bench/results/results.csv`, `report.md`, `results.json` (the
  playground About page can embed the JSON).

## Amendments

- **2026-07-05 (before first full real run):** the committed title list was
  extended from 10 to 30 articles across six page-shape groups. The
  pre-registered set is unchanged and remains the first 10 titles (the
  default `--articles 10`); results on the extended set are reported
  separately. Added `--titles-file` and `--external-jsonl` inputs; per-article
  breakdowns added to `results.json`. No metric or judging changes.

## Exclusions

- Questions whose gold answer appears in no condition's context are dropped
  (and counted) — they measure fetch failures, not formats.
- Articles whose sibling generation fails are dropped (and counted).
