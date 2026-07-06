# PageSkim Playground

Next.js app (App Router): paste HTML or fetch a URL, see the `.llm.md` sibling, the animated token-savings gauge, the two-hop retrieval simulator, and a free public `/api/convert`. Conversion runs through the same `@pageskim/core` as the CLI, so numbers match exactly.

## Develop

```bash
npm install            # from the repo root (workspaces)
npm run build          # build the packages once (playground imports their dist)
cd apps/playground
npm run dev            # http://localhost:3000 — prebuild embeds examples/
```

## Deploy (Vercel free tier)

- Import the repo, set **Root Directory** to `apps/playground` (framework: Next.js). `next build` runs the `prebuild` example-embedding script automatically.
- Optional: attach Vercel KV and set `KV_REST_API_URL` + `KV_REST_API_TOKEN` so the aggregate "tokens saved" counter persists across instances; without it an in-memory fallback is used.
- No other configuration. No user content is ever stored — paste-mode conversion happens in the visitor's browser (web worker); URL mode converts in-memory server-side.

## API

`POST /api/convert` with `{"html": "…"}` or `{"url": "https://…"}` → `{llmMd, llmJson, splitFiles, tokenReport, warnings, doc}`. Rate-limited per IP (20/min), CORS-open. URL mode identifies as `PageSkimBot/0.1`, respects robots.txt, caps at 5 MB / 10 s.
