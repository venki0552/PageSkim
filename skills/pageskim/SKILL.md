---
name: pageskim
description: Make a website readable by LLMs and agents at 10-50x fewer tokens by generating PageSkim .llm.md sibling files for its pages. Use when the user asks to "make my site agent-readable", "add llm.md / PageSkim to my site", "reduce token costs for agents reading my site", or similar. Detects the site generator (plain HTML, Astro, Next.js, Hugo, Jekyll), runs pageskim generate over the build output, wires a build step plus CI validation, and emits the site index.
---

# Make a site agent-readable with PageSkim

Goal: every published `page.html` gets a sibling `page.llm.md` (plus optional
`.llm.json` and split files), a `/.well-known/pageskim.json` site index, and
the build/CI wiring so siblings never go stale.

## Step 1 — detect the site generator and its output directory

Check, in order:

| Signal | Generator | Build output | Build command |
| --- | --- | --- | --- |
| `astro.config.*` | Astro | `dist/` | `npx astro build` |
| `next.config.*` | Next.js | `out/` (needs `output: "export"`) or pre-rendered `.next` — see note | `npx next build` |
| `hugo.toml` / `config.toml` with `baseURL` | Hugo | `public/` | `hugo` |
| `_config.yml` | Jekyll | `_site/` | `bundle exec jekyll build` |
| none of the above, `.html` files present | Plain HTML | the site root itself | — |

Note for Next.js without static export: siblings can only cover pre-rendered
pages. Offer the runtime alternative (`pageskim` SDK `fromDocument` +
`expose()`) for client-rendered routes, but prefer static export when the
user can enable it.

## Step 2 — generate siblings over the build output

```bash
npx pageskim generate <output-dir> --json --split --site-index --base-url <site-url>
```

- Run it AFTER the site build so siblings reflect the final HTML.
- `--base-url` should be the production origin (used for pages without a
  canonical URL and for the site index).
- Exit code 2 means one or more pages look client-rendered (near-empty HTML);
  list them for the user and suggest pre-rendering or the SDK fallback.

## Step 3 — wire it into the build

Add to `package.json` (or the equivalent Makefile/CI step):

```json
"scripts": {
  "postbuild": "pageskim generate <output-dir> --json --split --site-index --base-url <site-url>"
}
```

For Hugo/Jekyll (no npm), append to the deploy script:

```bash
hugo && npx --yes pageskim generate public --site-index --base-url <site-url>
```

## Step 4 — validate in CI

Use the repo's composite action, or the raw commands:

```yaml
- run: npm run build
- uses: venki0552/PageSkim/.github/action@main
  with:
    path: <output-dir>
    base-url: <site-url>
```

Raw equivalent:

```bash
npx pageskim generate <output-dir> --site-index --base-url <site-url>
for page in $(find <output-dir> -name '*.html' ! -name '*.llm.*'); do
  npx pageskim validate "$page" "${page%.html}.llm.md" || exit 1
done
```

## Step 5 — verify and report

1. Pick 2–3 generated siblings and confirm: header present, chunk anchors
   resolve, no nav/footer text leaked.
2. Run `npx pageskim validate` on them (exit 0).
3. Report the token table the generator printed (raw HTML vs sibling vs
   header-only) so the user sees the savings.
4. Suggest (optional): a `<link rel="alternate" type="text/llm+markdown">`
   tag in the site's head template, per spec §3.2.

## Scripts

- [scripts/generate-and-validate.sh](scripts/generate-and-validate.sh) —
  steps 2+4 as one script: `./generate-and-validate.sh <output-dir> <site-url>`.
