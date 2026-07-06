# @pageskim/validator

CLI that checks a [PageSkim](https://github.com/venki0552/PageSkim) sibling against its HTML page: structural conformance, spec version, content-hash staleness, chunk-anchor resolution, header budget, facts wellformedness, and **sentence-level grounding** — every sentence in the sibling must be derivable from the human-visible HTML, which catches cloaked content and injected prompt-instructions.

**Most users want the umbrella [`pageskim`](https://www.npmjs.com/package/pageskim) package**, which exposes this as `pageskim validate`:

```bash
npx pageskim validate page.html page.llm.md          # or a page.llm/ split dir
npx pageskim validate page.html page.llm.md --json   # machine-readable report
npx pageskim validate page.html page.llm.md --strict # warnings fail too
```

Exit codes: `0` valid, `1` violations, `2` usage/IO — CI-friendly; see the repo's [GitHub Action](https://github.com/venki0552/PageSkim/blob/main/.github/action.yml) for the one-step version. Validation logic lives in [`@pageskim/core`](https://www.npmjs.com/package/@pageskim/core) (`validateSibling`), so you can also run the same checks programmatically. MIT.
