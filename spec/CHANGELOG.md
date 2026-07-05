# PageSkim spec changelog

## 0.1.0 — 2026-07-05

Initial specification:

- Three-layer sibling structure (HEADER / FACTS / CHUNKS) with the two-hop
  retrieval contract.
- `.md` grammar and equivalent `.json` rendering + JSON Schema.
- TOON-style `@table` facts encoding with `\|`/`\\`/`\n` escaping.
- Chunk ID slugging, dedupe, and anchor rules.
- Normative extraction pipeline (boilerplate strip list, main-content
  selection, table classification, metadata harvest order).
- Tokenizer-independent budget metric (`ceil(utf8_bytes/4)`); header target
  100 / cap 150 with deterministic overflow sequence.
- SHA-256 content hash over normalized main-content text, truncated to 16
  hex characters (staleness detection, not adversarial integrity — saves
  ~25 header tokens).
- Split-file layout (`page.llm/`), site index (`/.well-known/pageskim.json`).
- Trust rules: derivability, no additive content, validator obligations,
  consumer posture.
- Edge-case matrix (malformed HTML, SPAs, huge pages, no-headings pages,
  non-English, pagination, thin pages, duplicate headings, boilerplate,
  llms.txt interop).
