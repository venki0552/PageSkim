"""Offline tests: no network, no API key, no node runtime required."""

import json
from pathlib import Path

import pytest

from pageskim_bench.cache import CachedProvider
from pageskim_bench.conditions import (
    build_context,
    html_to_markdown,
    llmstxt_context,
    parse_sibling_md,
    select_chunks,
    truncate,
)
from pageskim_bench.judge import ask, grade
from pageskim_bench.providers import FakeProvider
from pageskim_bench.qa import infobox_questions
from pageskim_bench.run import aggregate, Trial

REPO = Path(__file__).resolve().parent.parent.parent
SIBLING_MD = (REPO / "packages/core/test/fixtures/expected/article-infobox.llm.md").read_text()
HTML = (REPO / "examples/article-infobox/page.html").read_text()


@pytest.fixture
def sibling():
    return parse_sibling_md(SIBLING_MD)


def test_parse_sibling(sibling):
    assert sibling.title == "Lighthouse of Alexandria"
    assert "## facts" in sibling.facts
    assert "origin" in sibling.chunks
    assert sibling.header.startswith("<!-- pageskim 0.1 -->")


def test_markdown_baseline_strips_tags():
    md = html_to_markdown(HTML)
    assert "<p>" not in md
    assert "Pharos was a small island" in md
    # Boilerplate deliberately kept in this baseline:
    assert "Privacy policy" in md


def test_llmstxt_context_is_tiny(sibling):
    ctx = llmstxt_context(sibling)
    assert len(ctx) < 800
    assert "Lighthouse of Alexandria" in ctx


def test_twohop_selects_relevant_chunk(sibling):
    selected = select_chunks(sibling, "What did the travellers' measurements suggest about the height?")
    assert "height-and-description" in selected


def test_infobox_questions(sibling):
    questions = infobox_questions(sibling)
    assert 3 <= len(questions) <= 8
    heights = [q for q in questions if "height" in q.text]
    assert heights and heights[0].gold == "c. 100 m (330 ft)"


def test_all_conditions_build(sibling):
    for condition in ("raw-html", "markdown", "llmstxt", "pageskim-twohop"):
        ctx, truncated = build_context(condition, HTML, sibling, "What is the height?")
        assert len(ctx) > 50
        assert truncated is False


def test_truncation_marker():
    text, truncated = truncate("x" * 100, limit=10)
    assert truncated and text.endswith("[truncated]")


def test_cache_round_trip(tmp_path):
    provider = CachedProvider(FakeProvider(), cache_dir=tmp_path)
    first = provider.complete("You are grading answers.", "GOLD ANSWER: 42\nCANDIDATE ANSWER: it is 42")
    second = provider.complete("You are grading answers.", "GOLD ANSWER: 42\nCANDIDATE ANSWER: it is 42")
    assert first == second
    assert provider.hits == 1 and provider.misses == 1
    assert len(list(tmp_path.glob("*.json"))) == 1


def test_fake_end_to_end_micro_run(sibling, tmp_path):
    """The full ask→grade loop over two conditions, offline."""
    provider = CachedProvider(FakeProvider(), cache_dir=tmp_path)
    questions = infobox_questions(sibling)[:2]
    trials = []
    for q in questions:
        for condition in ("llmstxt", "pageskim-twohop"):
            ctx, truncated = build_context(condition, HTML, sibling, q.text)
            answer, tin, tout = ask(provider, q.text, ctx, run_nonce=1)
            correct = grade(provider, q.text, q.gold, answer)
            trials.append(
                Trial(q.article, condition, q.text, q.gold, 1, answer, correct, tin, tout, truncated)
            )
    report = aggregate(trials, "fake", 0, 0)
    # Two-hop has the facts; llms.txt (titles only) cannot answer infobox QA.
    assert report["conditions"]["pageskim-twohop"]["accuracy_mean"] == 1.0
    assert report["conditions"]["llmstxt"]["accuracy_mean"] == 0.0
    assert (
        report["conditions"]["pageskim-twohop"]["input_tokens_mean"]
        < len(HTML) // 4
    )
    json.dumps(report)  # serializable
