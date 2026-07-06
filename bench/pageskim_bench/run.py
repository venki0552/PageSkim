"""Benchmark orchestrator. See PROTOCOL.md (pre-registered) for the design.

Usage:
    python -m pageskim_bench.run --provider fake --articles 2      # offline
    python -m pageskim_bench.run --provider anthropic --articles 10

Sibling generation shells out to the repo's node CLI (packages/generator);
run `npm run build` at the repo root first, or pass --siblings-dir with
pre-generated .llm.md files.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import statistics
import subprocess
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

from .cache import CachedProvider
from .conditions import CONDITIONS, Sibling, build_context, parse_sibling_md
from .judge import ask, grade
from .providers import make_provider
from .qa import Question, infobox_questions
from .wikipedia import DATA_DIR, default_titles, fetch_article_html

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
RESULTS_DIR = Path(__file__).resolve().parent.parent / "results"
RUNS_PER_CONDITION = 3

# $ per 1M input/output tokens for the default model — EDIT alongside model
# changes; used only for the $-per-correct metric. Prices as of 2026-07-05.
PRICE_INPUT_PER_MTOK = 3.00
PRICE_OUTPUT_PER_MTOK = 15.00


@dataclass
class Trial:
    article: str
    condition: str
    question: str
    gold: str
    run: int
    answer: str
    correct: bool
    input_tokens: int
    output_tokens: int
    truncated: bool


def generate_sibling_md(html: str, cli: Path) -> str:
    """Convert HTML to a sibling via the repo's node generator (stdin mode)."""
    result = subprocess.run(
        ["node", str(cli), "-", "--quiet"],
        input=html.encode(),
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(f"sibling generation failed: {result.stderr.decode()[:400]}")
    return result.stdout.decode()


def mean_ci(values: list[float]) -> tuple[float, float]:
    if not values:
        return 0.0, 0.0
    mean = statistics.fmean(values)
    if len(values) < 2:
        return mean, 0.0
    sd = statistics.stdev(values)
    return mean, 1.96 * sd / math.sqrt(len(values))


def run_benchmark(args: argparse.Namespace) -> dict:
    provider = CachedProvider(make_provider(args.provider))
    if args.titles_file:
        titles = [
            t.strip()
            for t in Path(args.titles_file).read_text().splitlines()
            if t.strip() and not t.startswith("#")
        ]
    else:
        titles = default_titles()
    titles = titles[: args.articles]
    cli = REPO_ROOT / "packages" / "generator" / "dist" / "cli.js"

    external: list[Question] = []
    if args.external_jsonl:
        from .qa import load_external_jsonl

        external = load_external_jsonl(Path(args.external_jsonl), set(titles))
        print(f"[external] {len(external)} questions matched fetched articles")

    trials: list[Trial] = []
    dropped_articles = 0
    dropped_questions = 0

    for title in titles:
        print(f"[article] {title}")
        html = fetch_article_html(title)
        try:
            if args.siblings_dir:
                sibling_md = (Path(args.siblings_dir) / f"{title.replace('/', '_')}.llm.md").read_text()
            else:
                sibling_md = generate_sibling_md(html, cli)
        except (RuntimeError, FileNotFoundError) as err:
            print(f"  dropped ({err})")
            dropped_articles += 1
            continue
        sibling = parse_sibling_md(sibling_md)
        questions = infobox_questions(sibling) + [q for q in external if q.article == title]
        if not questions:
            dropped_articles += 1
            continue

        for question in questions:
            # Exclusion rule (PROTOCOL.md): gold must be reachable somewhere.
            if question.gold.lower() not in html.lower() and question.gold.lower() not in sibling_md.lower():
                dropped_questions += 1
                continue
            for condition in CONDITIONS:
                context, truncated = build_context(condition, html, sibling, question.text)
                for run in range(1, RUNS_PER_CONDITION + 1):
                    answer, tokens_in, tokens_out = ask(provider, question.text, context, run)
                    correct = grade(provider, question.text, question.gold, answer)
                    trials.append(
                        Trial(
                            article=title,
                            condition=condition,
                            question=question.text,
                            gold=question.gold,
                            run=run,
                            answer=answer,
                            correct=correct,
                            input_tokens=tokens_in,
                            output_tokens=tokens_out,
                            truncated=truncated,
                        )
                    )

    report = aggregate(trials, provider.name, dropped_articles, dropped_questions)
    report["cache"] = {"hits": provider.hits, "misses": provider.misses}
    write_outputs(trials, report)
    return report


def aggregate(trials: list[Trial], provider_name: str, dropped_articles: int, dropped_questions: int) -> dict:
    by_condition: dict[str, list[Trial]] = defaultdict(list)
    for t in trials:
        by_condition[t.condition].append(t)

    conditions = {}
    for condition in CONDITIONS:
        rows = by_condition.get(condition, [])
        if not rows:
            continue
        acc_mean, acc_ci = mean_ci([1.0 if t.correct else 0.0 for t in rows])
        in_mean, in_ci = mean_ci([float(t.input_tokens) for t in rows])
        total_in = sum(t.input_tokens for t in rows)
        total_out = sum(t.output_tokens for t in rows)
        n_correct = sum(1 for t in rows if t.correct)
        cost = total_in / 1e6 * PRICE_INPUT_PER_MTOK + total_out / 1e6 * PRICE_OUTPUT_PER_MTOK
        # Per-article breakdown: lets readers see variance across page shapes
        # instead of one blended number.
        per_article: dict[str, dict] = {}
        for article in sorted({t.article for t in rows}):
            article_rows = [t for t in rows if t.article == article]
            per_article[article] = {
                "trials": len(article_rows),
                "accuracy": round(sum(t.correct for t in article_rows) / len(article_rows), 4),
                "input_tokens_mean": round(
                    statistics.fmean(t.input_tokens for t in article_rows), 1
                ),
            }
        conditions[condition] = {
            "trials": len(rows),
            "accuracy_mean": round(acc_mean, 4),
            "accuracy_ci95": round(acc_ci, 4),
            "input_tokens_mean": round(in_mean, 1),
            "input_tokens_ci95": round(in_ci, 1),
            "tokens_per_correct": round(total_in / n_correct, 1) if n_correct else None,
            "dollars_per_correct": round(cost / n_correct, 6) if n_correct else None,
            "truncated_trials": sum(1 for t in rows if t.truncated),
            "per_article": per_article,
        }
    return {
        "provider": provider_name,
        "runs_per_condition": RUNS_PER_CONDITION,
        "articles": sorted({t.article for t in trials}),
        "questions": len({(t.article, t.question) for t in trials}),
        "dropped_articles": dropped_articles,
        "dropped_questions": dropped_questions,
        "conditions": conditions,
    }


def write_outputs(trials: list[Trial], report: dict) -> None:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    with open(RESULTS_DIR / "results.csv", "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(
            ["article", "condition", "question", "gold", "run", "answer", "correct", "input_tokens", "output_tokens", "truncated"]
        )
        for t in trials:
            writer.writerow(
                [t.article, t.condition, t.question, t.gold, t.run, t.answer, t.correct, t.input_tokens, t.output_tokens, t.truncated]
            )
    (RESULTS_DIR / "results.json").write_text(json.dumps(report, indent=2) + "\n")

    lines = [
        "# PageSkim benchmark report",
        "",
        f"Provider: `{report['provider']}` — {report['runs_per_condition']} runs/condition — "
        f"dropped articles: {report['dropped_articles']}, dropped questions: {report['dropped_questions']}",
        "",
        "| condition | accuracy (±95% CI) | input tokens/trial | tokens per correct | $ per correct |",
        "| --- | --- | ---: | ---: | ---: |",
    ]
    for name, c in report["conditions"].items():
        lines.append(
            f"| {name} | {c['accuracy_mean']:.2%} ± {c['accuracy_ci95']:.2%} "
            f"| {c['input_tokens_mean']:,.0f} | {c['tokens_per_correct'] or '—'} | "
            f"{'$' + format(c['dollars_per_correct'], '.4f') if c['dollars_per_correct'] else '—'} |"
        )
    (RESULTS_DIR / "report.md").write_text("\n".join(lines) + "\n")
    print("\n".join(lines))


def main() -> None:
    parser = argparse.ArgumentParser(description="PageSkim benchmark harness")
    parser.add_argument("--provider", default="fake", help="fake | anthropic | anthropic:<model>")
    parser.add_argument("--articles", type=int, default=10, help="first N titles from the list")
    parser.add_argument("--titles-file", default=None, help="custom corpus: one Wikipedia title per line")
    parser.add_argument(
        "--external-jsonl",
        default=None,
        help='extra questions: JSONL of {"question","answer","title"} (e.g. NQ/HotpotQA subsets)',
    )
    parser.add_argument("--siblings-dir", default=None, help="pre-generated .llm.md files (skip node CLI)")
    run_benchmark(parser.parse_args())


if __name__ == "__main__":
    main()
