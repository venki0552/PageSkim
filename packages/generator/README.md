# @pageskim/generator

CLI that emits [PageSkim](https://github.com/pageskim/pageskim) sibling files (`page.llm.md` + optional `.llm.json`, split directories, and a site index) for HTML files, directories, or stdin.

**Most users want the umbrella [`pageskim`](https://www.npmjs.com/package/pageskim) package**, which exposes this as `pageskim generate`:

```bash
npx pageskim generate ./dist --json --split --site-index --base-url https://example.com
```

This package exists as a standalone dependency (`pageskim-generate` bin) for tooling that only needs generation. All conversion logic lives in [`@pageskim/core`](https://www.npmjs.com/package/@pageskim/core); output is deterministic — reruns are byte-identical.

Options: `--out DIR` (mirror structure elsewhere), `--json`, `--split`, `--site-index`, `--base-url URL`, `--quiet`. Reads stdin with `-`. Exit codes: `0` ok, `1` usage/IO, `2` extraction failed (client-rendered page — pre-render it or use the SDK's `fromDocument`).

Docs: [publisher guide](https://github.com/pageskim/pageskim/blob/main/docs/integration.md) · [framework adapters](https://github.com/pageskim/pageskim/blob/main/docs/adapters.md). MIT.
