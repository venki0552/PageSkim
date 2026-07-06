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

1. Import `venki0552/PageSkim` on Vercel and set **Root Directory** to `apps/playground`. Framework auto-detects as Next.js.
2. Keep **"Include source files outside of the Root Directory"** enabled (Settings → General → Root Directory — it's the default). The build needs the repo root: workspace packages are built there and `examples/` is embedded from there.
3. Install/build commands come from [`vercel.json`](vercel.json) in this directory — no dashboard overrides needed:
   - install: `cd ../.. && npm ci` (whole workspace from the root lockfile)
   - build: `cd ../.. && npm run build && cd apps/playground && npm run build` (packages first — their `dist/` must exist — then example embedding + `next build`)
4. Optional: attach Vercel KV and set `KV_REST_API_URL` + `KV_REST_API_TOKEN` so the aggregate "tokens saved" counter persists across instances; without it an in-memory fallback is used. No other env vars are required.
5. Post-deploy smoke test: home page converts an example; URL mode on a Wikipedia page; `curl -X POST <url>/api/convert -H 'Content-Type: application/json' -d '{"html":"<h1>hi</h1><p>hello world</p>"}'`; `/about` renders; dark-mode toggle.

No user content is ever stored — paste-mode conversion happens in the visitor's browser (web worker); URL mode converts in-memory server-side.

## API

`POST /api/convert` with `{"html": "…"}` or `{"url": "https://…"}` → `{llmMd, llmJson, splitFiles, tokenReport, warnings, doc}`. Rate-limited per IP (20/min), CORS-open. URL mode identifies as `PageSkimBot/0.1`, respects robots.txt, caps at 5 MB / 10 s.
