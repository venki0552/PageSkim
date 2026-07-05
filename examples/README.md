# Example pages

Four sample pages exercising the main page types PageSkim targets. Later phases use them as generator/validator fixtures and for the token-reduction tables.

| Directory | Page type | Exercises |
| --- | --- | --- |
| [`article-infobox/`](article-infobox) | Encyclopedia-style article | Infobox data table → FACTS, h2/h3 chunking, figure captions, references, nav/sidebar boilerplate |
| [`docs/`](docs) | Documentation page | Code blocks preserved verbatim, config-reference data table, sidebar nav stripping |
| [`blog/`](blog) | Blog post | OpenGraph/meta harvesting, byline facts, prose-stays-prose, cookie banner + comments boilerplate |
| [`product/`](product) | Product page | JSON-LD harvesting, price/spec facts, layout-vs-data table heuristic, add-to-cart boilerplate |

Each page is static, self-contained HTML with anchored headings (`id` attributes), so generated chunk IDs can be checked against real anchors.
