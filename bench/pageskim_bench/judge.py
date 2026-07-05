"""LLM judging: is the candidate answer correct given the gold answer?"""

from __future__ import annotations

from .providers import Provider

JUDGE_SYSTEM = (
    "You are grading benchmark answers. Given a question, the gold answer, "
    "and a candidate answer, respond with exactly one word: CORRECT if the "
    "candidate conveys the gold answer (paraphrase and extra context are "
    "fine; different units are fine if equivalent), otherwise INCORRECT."
)

ANSWER_SYSTEM = (
    "Answer the question using ONLY the provided context. Reply with the "
    "answer alone, as briefly as possible. If the context does not contain "
    "the answer, reply exactly: I don't know."
)


def ask(provider: Provider, question: str, context: str, run_nonce: int) -> tuple[str, int, int]:
    prompt = f"[run {run_nonce}]\nQUESTION: {question}\n\nCONTEXT:\n{context}"
    completion = provider.complete(ANSWER_SYSTEM, prompt)
    return completion.text, completion.input_tokens, completion.output_tokens


def grade(provider: Provider, question: str, gold: str, candidate: str) -> bool:
    prompt = (
        f"QUESTION: {question}\nGOLD ANSWER: {gold}\nCANDIDATE ANSWER: {candidate}"
    )
    completion = provider.complete(JUDGE_SYSTEM, prompt)
    return completion.text.strip().upper().startswith("CORRECT")
