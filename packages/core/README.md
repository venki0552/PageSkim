# @pageskim/core

The pure, isomorphic conversion library for the [PageSkim format](https://github.com/venki0552/PageSkim/blob/main/spec/SPEC.md): parse HTML → extract content → emit `page.llm.md` / `page.llm.json` siblings that LLMs and agents read at 10–50x fewer tokens.

Everything else — the [`pageskim` CLI/SDK](https://www.npmjs.com/package/pageskim), the playground, the GitHub Action — is a thin wrapper around this package, so conversion output is byte-identical everywhere.

**Most users want [`pageskim`](https://www.npmjs.com/package/pageskim) instead** (CLI + browser SDK). Depend on core directly when you're building your own tooling.

```ts
import { convert, validateSibling, parseSibling } from "@pageskim/core";
import { countTokens } from "@pageskim/core/tokenizer"; // optional, heavy (o200k)

const result = convert(html, { countTokens });
if (result.ok) {
  result.md;          // the .llm.md sibling
  result.json;        // the .llm.json mirror
  result.splitFiles;  // { "_header.md": …, "facts.md": …, "<chunk>.md": … }
  result.report;      // token counts per layer
}

validateSibling(html, result.md); // structural + hash + anchor + grounding checks
```

Guarantees:

- **Isomorphic** — runs unmodified in Node, browsers, and edge runtimes; no network calls, no Node-only APIs.
- **Deterministic** — same input → byte-identical output, with or without the tokenizer (spec §9's budget metric governs all content-affecting decisions).
- The heavy o200k tokenizer lives behind the `@pageskim/core/tokenizer` subpath so browser bundles stay small; without it, token *reports* use a labeled bytes/4 estimate while output bytes are unchanged.

Docs: [format spec](https://github.com/venki0552/PageSkim/blob/main/spec/SPEC.md) · [publisher guide](https://github.com/venki0552/PageSkim/blob/main/docs/integration.md) · [consumer guide](https://github.com/venki0552/PageSkim/blob/main/docs/consuming.md). MIT.
