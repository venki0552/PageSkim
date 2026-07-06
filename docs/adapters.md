# Framework adapters

The generator works on any directory of built HTML, so "integration" is
usually one post-build line. Recipes for common stacks:

## Next.js (static export)

```ts
// next.config.ts
const nextConfig = { output: "export" }; // build writes ./out
export default nextConfig;
```

```json
// package.json
"scripts": {
  "postbuild": "pageskim generate out --json --split --site-index --base-url https://example.com"
}
```

Routes that only render client-side can't have build-time siblings — use the
[`pageskim` SDK](../packages/sdk/README.md) (`fromDocument` + `expose()`)
after hydration for those, and prefer pre-rendering wherever possible.

## Astro

```json
"scripts": {
  "postbuild": "pageskim generate dist --json --split --site-index --base-url https://example.com"
}
```

Integration sketch (runs automatically inside `astro build`):

```ts
// pageskim-integration.ts
import { execFileSync } from "node:child_process";
import type { AstroIntegration } from "astro";

export default function pageskim(baseUrl: string): AstroIntegration {
  return {
    name: "pageskim",
    hooks: {
      "astro:build:done": ({ dir }) => {
        execFileSync(
          "npx",
          ["--yes", "pageskim", "generate", new URL(dir).pathname, "--site-index", "--base-url", baseUrl],
          { stdio: "inherit" },
        );
      },
    },
  };
}
```

## Hugo

```bash
hugo && npx --yes pageskim generate public --site-index --base-url https://example.com
```

Or as a `publish` script in CI. Hugo's `public/` layout (directory URLs with
`index.html`) works out of the box: siblings land as `index.llm.md` next to
each `index.html`.

## Jekyll (incl. GitHub Pages via Actions)

```yaml
# .github/workflows/pages.yml (excerpt)
- run: bundle exec jekyll build
- uses: venki0552/PageSkim/.github/action@main
  with:
    path: _site
    base-url: https://example.github.io
- uses: actions/upload-pages-artifact@v3
  with:
    path: _site
```

## Anything else

If it produces a folder of HTML, this works:

```bash
npx pageskim generate <folder> --json --split --site-index --base-url <origin>
```

Serve `.llm.md` as `text/markdown; charset=utf-8` and consider adding
`<link rel="alternate" type="text/llm+markdown" href="page.llm.md">` to your
head template (spec §3.2).
