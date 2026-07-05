# AgentPage Format Specification

**Status: placeholder — the v0.1 spec is written in Phase 1.**

This document will normatively define:

- Naming and discovery (`page.llm.md`, `page.llm.json`, `/.well-known/agentpage.json`)
- The three-layer structure: HEADER (≤100 tokens target, 150 hard cap) / FACTS / CHUNKS
- Exact grammar of the `.md` rendering and a JSON Schema for the `.json` rendering
- TOON-style compact tabular facts encoding (headers, rows, escaping, when NOT to use it)
- Chunk ID stability rules and anchor requirements
- Content-hash computation
- Split-file layout (`page.llm/_header.md`, `facts.md`, one file per chunk) and the two-hop retrieval contract
- Trust rules: sibling content MUST be derivable from the human-visible HTML (anti-cloaking, anti-prompt-injection)
- Edge-case behaviors (malformed HTML, SPAs, no-headings pages, huge pages, non-English content, …)
- Design rationale with the evidence base
- Versioning and changelog policy

Until Phase 1 lands, the [repository README](../README.md) is the best overview of the format.
