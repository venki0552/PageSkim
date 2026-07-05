# PageSkim benchmark harness (scaffold)

The full harness arrives in **Phase 5**. It will measure, per question, four conditions — raw HTML, plain markdown, llms.txt-style, and PageSkim two-hop — reporting accuracy (LLM-judged vs. gold), input/output tokens, tokens-per-correct-answer, and $ per correct answer, with 3 runs per condition (mean ± CI) and disk-cached API calls. The protocol is pre-registered in `PROTOCOL.md` before the first full run.

## Setup

```bash
python3.11 -m venv .venv
.venv/bin/pip install -e ".[dev]"
.venv/bin/pytest
```
