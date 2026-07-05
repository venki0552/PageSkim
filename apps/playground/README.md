# PageSkim Playground (placeholder)

The playground arrives in **Phase 4**: a Next.js (App Router) app deployable to the Vercel free tier that imports `@pageskim/core` directly, featuring:

- Paste-HTML / URL input with per-example "try it" buttons
- Tabbed output (`.llm.md`, `.llm.json`, split files) side-by-side with extracted HTML
- The hero **token-savings counter** (raw HTML → PageSkim → header-only, with $ estimates)
- A client-side **two-hop retrieval simulator** (no LLM, no API keys)
- A free public `/api/convert` endpoint
- An aggregate "tokens saved so far" counter and an About page

This directory only reserves the npm workspace so root scripts stay stable.
