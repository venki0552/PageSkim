# Adopting PageSkim properly — publisher guide

This is the "do it right" checklist for putting PageSkim on a real site. The
one-liner (`npx pageskim generate ./dist --site-index`) works, but the details
below are what make siblings *reliably useful* to agents: correct serving,
discoverability, freshness, and CI enforcement.

For framework-specific build wiring (Next.js, Astro, Hugo, Jekyll) see
[adapters.md](adapters.md). For the format itself see the
[spec](../spec/SPEC.md). For client-rendered apps see
[the SDK README](../packages/sdk/README.md).

## 1. Decide what to emit

| Output | Flag | Emit when |
| --- | --- | --- |
| `page.llm.md` (combined) | always on | Always. This is the format's required artifact. |
| `page.llm.json` | `--json` | You expect programmatic consumers (agents parsing structure rather than reading markdown). Cheap; recommended. |
| `page.llm/` split directory | `--split` | Your pages are long enough that the two-hop contract pays off (roughly: siblings over ~1,500 tokens). Agents fetch `_header.md` (~150 tokens) and then only the chunks they need. For short pages the combined file alone is fine. |
| `/.well-known/pageskim.json` | `--site-index` | Always, for any multi-page site. It's how agents discover coverage without probing URLs. |

Recommended default for most sites: **all four**.

```bash
npx pageskim generate <output-dir> --json --split --site-index --base-url https://your-site.com
```

`--base-url` matters: pages without a `<link rel="canonical">` get their URL
derived from it, and the site index uses it. Set it to your production origin.

## 2. Serve the files correctly

Siblings are static files; any host works. Three server details worth getting
right:

1. **Content types.**
   - `*.llm.md` and files under `*.llm/` → `text/markdown; charset=utf-8`
   - `*.llm.json` and `/.well-known/pageskim.json` → `application/json`
2. **Caching.** Treat siblings exactly like the HTML they mirror — same
   `Cache-Control`, invalidated together on deploy. A stale sibling next to
   fresh HTML fails hash validation and erodes trust. If you use an atomic
   deploy platform (Vercel, Netlify, Pages), this is automatic since siblings
   are generated in the same build.
3. **CORS.** Add `Access-Control-Allow-Origin: *` for `*.llm.*` paths if you
   want browser-based agents to read them. (Server-side agents don't need it.)

Example nginx snippet:

```nginx
location ~ \.llm\.md$   { types { } default_type "text/markdown; charset=utf-8"; add_header Access-Control-Allow-Origin *; }
location ~ \.llm\.json$ { types { } default_type application/json;             add_header Access-Control-Allow-Origin *; }
```

## 3. Make the siblings discoverable

Agents find PageSkim files three ways (spec §3.2), in this order of
preference. Implement at least the first two:

1. **Site index** — `/.well-known/pageskim.json` (the `--site-index` flag).
2. **Link relation** — add to your HTML head template:

   ```html
   <link rel="alternate" type="text/llm+markdown" href="page.llm.md">
   ```

   (Relative to the page; most templating layers can derive it from the
   page's own path.)
3. **Naming convention** — `page.html` → `page.llm.md` works as a fallback
   probe; you get this for free.

If you already publish an `llms.txt`, keep it — the two are complementary
(llms.txt is a curated site map; PageSkim is the per-page content layer).
Consider linking your site index from it.

## 4. Keep siblings fresh — generate in the build, enforce in CI

The single most important rule: **siblings are build artifacts, not source
files.** Never hand-edit them; regenerate on every build so the content hash
always matches the HTML.

- Add generation as a `postbuild` step (see [adapters.md](adapters.md)).
- Add validation to CI so a drifted or hand-edited sibling fails the build:

  ```yaml
  - uses: pageskim/pageskim/.github/action@main
    with:
      path: dist
      base-url: https://your-site.com
  ```

- Add generated siblings to `.gitignore` if your deploy builds from source
  (most CI/CD); commit them only if you deploy pre-built artifacts from git.

## 5. Author pages so extraction works well

The generator is heuristic; these authoring habits make its output noticeably
better (and are good HTML anyway):

- **Put `id` attributes on your `h2`/`h3` headings.** Chunk IDs then match
  your real anchors and survive retitling (spec §7.2). Most markdown
  pipelines (GitHub, Hugo, Astro) already do this.
- **Use semantic containers** — `<main>` or `<article>` around content;
  `<nav>`, `<footer>`, `<aside>` around chrome. The stripper also matches
  common class names (`sidebar`, `cookie`, `promo`, …) but tags are surer.
- **Mark up data as data**: real `<th>` cells in tables, `<dl>` for
  definition lists, JSON-LD for products/articles. That's what feeds FACTS.
- **Give images meaningful `alt` text** — it's what agents get instead of
  the image.
- **Keep meta description accurate** — it becomes the sibling's one-line
  summary, the highest-leverage tokens on the page.

Then eyeball one generated sibling per template type (`cat page.llm.md`):
check the header reads sensibly, no nav text leaked, facts look right.

## 6. Client-rendered pages (SPAs)

Build-time generation needs server-rendered or pre-rendered HTML. Your
options, best first:

1. Pre-render/static-export the routes (Next.js `output: "export"`, Astro,
   SSG of your choice) and generate normally.
2. Pre-render just for the generator (any headless-browser snapshot step),
   feed the rendered HTML to `pageskim generate -`.
3. Runtime fallback: the [`pageskim` SDK](../packages/sdk/README.md) —
   `expose(fromDocument(document), document)` after hydration injects the
   sibling into the DOM. Least preferred: it requires the agent to execute
   your JavaScript.

The generator refuses to emit misleading siblings for script-heavy empty
shells (exit code 2) rather than failing silently.

## 7. Verify the win

```bash
npx pageskim generate dist --quiet && npx pageskim generate dist
```

prints the raw → sibling → header-only token table. Sanity targets: ≥5x for
the full sibling on content pages, ≥50x header-only. If a page comes out
worse, it's usually thin content or an extraction miss — file an issue with
the HTML, that's exactly what the [bug template](../.github/ISSUE_TEMPLATE/bug_report.yml)
asks for.

## Adoption checklist

- [ ] `generate` wired as a post-build step with `--base-url`
- [ ] `--json --split --site-index` on (or a deliberate subset per §1)
- [ ] Content types + caching parity configured (§2)
- [ ] `<link rel="alternate" type="text/llm+markdown">` in the head template
- [ ] CI validation via the GitHub Action (§4)
- [ ] Siblings gitignored (build artifact), never hand-edited
- [ ] Headings carry `id`s; content in `<main>`/`<article>` (§5)
- [ ] One sibling per template type manually reviewed
