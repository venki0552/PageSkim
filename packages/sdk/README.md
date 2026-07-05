# pageskim

Make any web page readable by LLMs and agents at **10–50x fewer tokens** — in the browser, with no build step required. This package is the browser SDK and umbrella CLI for the [PageSkim format](../../spec/SPEC.md); all conversion logic lives in `@pageskim/core`, so output is byte-identical to the CLI and the playground.

## Install

```bash
npm install pageskim          # SDK + CLI
npx pageskim generate site/   # CLI: emit .llm.md siblings
npx pageskim validate page.html page.llm.md
```

Or with no build step at all:

```html
<script src="https://unpkg.com/pageskim/dist/pageskim.min.js"></script>
<!-- optional, heavy (~1MB gz): o200k token counts instead of estimates -->
<script src="https://unpkg.com/pageskim/dist/pageskim.tokenizer.min.js"></script>
```

Bundle sizes: `pageskim.min.js` is ~68 KB gzipped (within the 150 KB budget). The tokenizer addon is ~1 MB gzipped, which is why it's a separate, optional file — without it, token *counts* are labeled estimates (bytes/4), while conversion output is identical either way.

## API

```js
import { fromHTML, fromDocument, savings, tokenCount, expose, loadTokenizer } from "pageskim";
// <script> usage: the same functions on the global `PageSkim`.

// Convert an HTML string.
const { llmMd, llmJson, splitFiles, tokenReport, warnings } = fromHTML(html);

// Convert the LIVE rendered DOM — the official answer for client-rendered
// apps: call after hydration and the sibling reflects what users see.
const result = fromDocument(document);

// Just the counter.
savings(html); // { rawTokens, siblingTokens, headerTokens, savedPct, headerSavedPct, basis }
tokenCount("some text");

// Optional: swap the estimator for real o200k counts (lazy, ~MBs).
await loadTokenizer();

// SPA fallback: inject the sibling into the DOM for crawlers/agents:
//   <script type="text/llm+markdown" id="pageskim">…</script>
//   <link rel="alternate" type="text/llm+markdown">
expose(result, document);
```

**Prefer static sibling files.** `expose()` exists for SPAs that cannot pre-render; static `page.llm.md` files are cacheable and fetchable without executing JavaScript. Generate them at build time with `npx pageskim generate`.

`fromHTML` throws a `PageSkimError` with `code: "EMPTY_EXTRACTION"` for script-heavy pages with no server-rendered content — that is your cue to use `fromDocument` after hydration instead.

## `<pageskim-badge>`

A tiny widget showing "This page: X tokens as HTML → Y as PageSkim (Z% saved)" with a copy button:

```html
<pageskim-badge></pageskim-badge>
<script src="https://unpkg.com/pageskim/dist/pageskim.min.js"></script>
```

With a bundler, call `definePageskimBadge()` once in browser code (it is a safe no-op during SSR).

## Recipes

### Plain HTML page

See [`fixtures/demo.html`](fixtures/demo.html) — badge + console savings + runtime exposure, zero build step.

### React

```jsx
import { useEffect } from "react";
import { fromDocument, expose } from "pageskim";

export function AgentReadable() {
  useEffect(() => {
    // After hydration, the DOM is the source of truth.
    expose(fromDocument(document), document);
  }, []);
  return null;
}
```

### Vue

```js
import { onMounted } from "vue";
import { fromDocument, expose } from "pageskim";

export function useAgentReadable() {
  onMounted(() => expose(fromDocument(document), document));
}
```

### WordPress (footer script, any theme)

```html
<script src="https://unpkg.com/pageskim/dist/pageskim.min.js"></script>
<script>
  window.addEventListener("load", function () {
    PageSkim.expose(PageSkim.fromDocument(document), document);
  });
</script>
```

(Better: generate static siblings from your published HTML with `npx pageskim generate` in a deploy hook.)

### Browser extension content script

```js
import { fromDocument } from "pageskim";

// e.g. feed the compact sibling to your extension's model call instead of
// innerText or raw HTML.
const { llmMd, tokenReport } = fromDocument(document);
console.log(`sending ${tokenReport.sibling} tokens instead of ${tokenReport.rawHtml}`);
```

## SSR safety

Importing `pageskim` touches no browser globals; `fromHTML` works in Node and edge runtimes. Only `fromDocument`, `expose`, and the badge need a DOM.
