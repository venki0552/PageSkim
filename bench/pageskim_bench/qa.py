"""Question generation: deterministic infobox QA + external-dataset loader."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

from .conditions import Sibling

MAX_QUESTIONS_PER_ARTICLE = 8

# Facts keys that make bad questions (self-referential/meta).
_SKIP_KEYS = {"modified", "published", "author", "url", "image", "type", "name", "sameas", "mainentity"}


@dataclass(frozen=True)
class Question:
    article: str
    text: str
    gold: str


def infobox_questions(sibling: Sibling) -> list[Question]:
    """Template questions over the sibling's facts key-value lines."""
    questions: list[Question] = []
    for line in sibling.facts.splitlines():
        m = re.match(r"^- ([^:]+): (.+)$", line)
        if not m:
            continue
        key, value = m.group(1).strip(), m.group(2).strip()
        if key in _SKIP_KEYS or "." in key or len(value) < 2 or value.startswith("http"):
            continue
        questions.append(
            Question(
                article=sibling.title,
                text=f"What is the {key} of {sibling.title}?",
                gold=value,
            )
        )
        if len(questions) == MAX_QUESTIONS_PER_ARTICLE:
            break
    return questions


def load_external_jsonl(path: Path, article_titles: set[str]) -> list[Question]:
    """Loader for Natural Questions / HotpotQA subsets in a simple JSONL form:
    {"question": ..., "answer": ..., "title": ...}. Filtered to fetched
    articles. The harness never downloads these datasets itself."""
    questions: list[Question] = []
    for line in path.read_text().splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        if row.get("title") in article_titles:
            questions.append(Question(article=row["title"], text=row["question"], gold=row["answer"]))
    return questions
