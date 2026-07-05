"""Build the four benchmark conditions' contexts from a page + its sibling."""

from __future__ import annotations

import math
import re
from dataclasses import dataclass
from html.parser import HTMLParser

MAX_CONTEXT_CHARS = 400_000
CONDITIONS = ("raw-html", "markdown", "llmstxt", "pageskim-twohop")


def truncate(text: str, limit: int = MAX_CONTEXT_CHARS) -> tuple[str, bool]:
    if len(text) <= limit:
        return text, False
    return text[:limit] + "\n[truncated]", True


# ---------------------------------------------------------- markdown baseline

_SKIP = {"script", "style", "noscript", "template"}
_HEADINGS = {"h1": "#", "h2": "##", "h3": "###", "h4": "####"}


class _MdExtractor(HTMLParser):
    """Cheap HTML→markdown-ish text: tags stripped, headings marked,
    boilerplate deliberately NOT removed (that's the point of the baseline)."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.out: list[str] = []
        self._skip_depth = 0
        self._pending_prefix = ""

    def handle_starttag(self, tag: str, attrs) -> None:  # noqa: ANN001
        if tag in _SKIP:
            self._skip_depth += 1
        elif tag in _HEADINGS:
            self.out.append("\n\n" + _HEADINGS[tag] + " ")
        elif tag in {"p", "div", "section", "article", "li", "tr", "br"}:
            self.out.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in _SKIP and self._skip_depth > 0:
            self._skip_depth -= 1

    def handle_data(self, data: str) -> None:
        if self._skip_depth == 0:
            self.out.append(data)


def html_to_markdown(html: str) -> str:
    parser = _MdExtractor()
    parser.feed(html)
    text = "".join(parser.out)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


# ------------------------------------------------------------ sibling parsing


@dataclass
class Sibling:
    header: str
    facts: str
    chunks: dict[str, str]  # id -> full "## chunk" section
    title: str


def parse_sibling_md(md: str) -> Sibling:
    sections = re.split(r"\n(?=## )", md)
    header = sections[0].rstrip()
    facts = ""
    chunks: dict[str, str] = {}
    for section in sections[1:]:
        if section.startswith("## facts"):
            facts = section.rstrip()
        elif section.startswith("## chunk "):
            chunk_id = section.splitlines()[0][len("## chunk ") :].strip()
            chunks[chunk_id] = section.rstrip()
        elif section.startswith("## toc"):
            header = f"{header}\n{section.rstrip()}"
    title_match = re.search(r"^# (.+)$", md, re.M)
    return Sibling(header, facts, chunks, title_match.group(1) if title_match else "")


# --------------------------------------------------------------- llms.txt-ish


def llmstxt_context(sibling: Sibling) -> str:
    """Title + summary + section index — what a link digest gives you."""
    summary = ""
    m = re.search(r"^> (.+)$", sibling.header, re.M)
    if m:
        summary = m.group(1)
    lines = [f"# {sibling.title}", "", f"> {summary}", "", "## Sections"]
    lines += [f"- {chunk_id}" for chunk_id in sibling.chunks]
    return "\n".join(lines)


# ----------------------------------------------------------- two-hop selection

_TOKEN = re.compile(r"[\w']+")


def _tokens(text: str) -> list[str]:
    return [t.lower() for t in _TOKEN.findall(text) if len(t) > 1]


def select_chunks(sibling: Sibling, question: str, k: int = 3) -> list[str]:
    """BM25-lite over chunk sections (mirrors the playground simulator)."""
    query = set(_tokens(question))
    docs = {cid: _tokens(text) for cid, text in sibling.chunks.items()}
    if not docs:
        return []
    avg_len = sum(len(d) for d in docs.values()) / len(docs)
    n = len(docs)
    scores: dict[str, float] = {}
    for cid, toks in docs.items():
        score = 0.0
        for term in query:
            tf = toks.count(term)
            if tf == 0:
                continue
            df = sum(1 for d in docs.values() if term in d)
            idf = math.log(1 + (n - df + 0.5) / (df + 0.5))
            score += idf * tf * 2.4 / (tf + 1.4 * (0.25 + 0.75 * len(toks) / avg_len))
        scores[cid] = score
    ranked = sorted(scores, key=lambda c: (-scores[c], c))
    positive = [c for c in ranked if scores[c] > 0][:k]
    return positive or ranked[:1]


def twohop_context(sibling: Sibling, question: str) -> str:
    selected = select_chunks(sibling, question)
    parts = [sibling.header, sibling.facts] + [sibling.chunks[c] for c in selected]
    return "\n\n".join(p for p in parts if p)


def build_context(condition: str, html: str, sibling: Sibling, question: str) -> tuple[str, bool]:
    if condition == "raw-html":
        return truncate(html)
    if condition == "markdown":
        return truncate(html_to_markdown(html))
    if condition == "llmstxt":
        return truncate(llmstxt_context(sibling))
    if condition == "pageskim-twohop":
        return truncate(twohop_context(sibling, question))
    raise ValueError(f"unknown condition: {condition}")
