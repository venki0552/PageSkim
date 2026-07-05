"""Provider-agnostic model interface.

The default real provider is the Anthropic API; anything with an
OpenAI-compatible endpoint can be added the same way. FakeProvider makes the
whole harness runnable offline (tests, dry runs): it "answers correctly" iff
the gold string appears in the provided context, which is exactly the signal
the benchmark design needs to differentiate conditions.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class Completion:
    text: str
    input_tokens: int
    output_tokens: int


class Provider(Protocol):
    name: str

    def complete(self, system: str, prompt: str) -> Completion: ...


class AnthropicProvider:
    """Real provider. Requires `pip install -e '.[anthropic]'` and
    ANTHROPIC_API_KEY (or an active `ant auth login` profile)."""

    def __init__(self, model: str = "claude-sonnet-4-6") -> None:
        import anthropic  # lazy: not needed for offline runs/tests

        self.name = f"anthropic:{model}"
        self.model = model
        self._client = anthropic.Anthropic()

    def complete(self, system: str, prompt: str) -> Completion:
        response = self._client.messages.create(
            model=self.model,
            max_tokens=1024,
            system=system,
            messages=[{"role": "user", "content": prompt}],
        )
        text = "".join(b.text for b in response.content if b.type == "text")
        return Completion(
            text=text,
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
        )


class FakeProvider:
    """Deterministic offline provider.

    Answer calls: extracts the line containing the question's key terms from
    the context; if the context truly contains the answer, the extraction
    contains it too. Judge calls: substring verdict. Token counts are
    len//4 estimates so cost math is exercised.
    """

    name = "fake"

    _ANSWER = re.compile(r"QUESTION:\s*(.+?)\n", re.S)

    def complete(self, system: str, prompt: str) -> Completion:
        if "You are grading" in system:
            gold = _between(prompt, "GOLD ANSWER:", "\n")
            candidate = _after(prompt, "CANDIDATE ANSWER:")
            verdict = "CORRECT" if gold and _norm(gold) in _norm(candidate) else "INCORRECT"
            return Completion(verdict, len(prompt) // 4, 2)

        question_match = self._ANSWER.search(prompt)
        question = question_match.group(1) if question_match else ""
        context = _after(prompt, "CONTEXT:")
        terms = [t for t in re.findall(r"[a-z0-9]{3,}", question.lower()) if t not in _STOP]
        lines = context.splitlines()
        # Rare terms discriminate; title words appear on every line. Weight
        # each term by inverse line frequency, like a real model attending to
        # the informative part of the question.
        weight = {
            t: 1.0 / max(1, sum(1 for line in lines if t in line.lower())) for t in terms
        }
        best_line = ""
        best_score = 0.0
        for line in lines:
            lowered = line.lower()
            score = sum(weight[t] for t in terms if t in lowered)
            if score > best_score:
                best_score, best_line = score, line
        return Completion(best_line.strip() or "I don't know.", len(prompt) // 4, len(best_line) // 4)


_STOP = {"what", "the", "was", "who", "when", "where", "which", "how"}


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def _between(s: str, start: str, end: str) -> str:
    i = s.find(start)
    if i == -1:
        return ""
    j = s.find(end, i + len(start))
    return s[i + len(start) : j if j != -1 else len(s)].strip()


def _after(s: str, start: str) -> str:
    i = s.find(start)
    return s[i + len(start) :].strip() if i != -1 else ""


def make_provider(spec: str) -> Provider:
    """"fake", "anthropic", or "anthropic:<model-id>"."""
    if spec == "fake":
        return FakeProvider()
    if spec == "anthropic":
        return AnthropicProvider()
    if spec.startswith("anthropic:"):
        return AnthropicProvider(model=spec.split(":", 1)[1])
    raise ValueError(f"unknown provider: {spec}")
