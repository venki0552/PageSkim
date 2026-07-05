import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — PageSkim Playground",
};

export default function About() {
  return (
    <article className="about-prose">
      <h1>What is PageSkim?</h1>
      <p>
        PageSkim is an open-source format and toolchain that gives every HTML page a compact{" "}
        <strong>sibling file</strong> (<code>page.llm.md</code>) that LLMs and agents can read at
        10–50x fewer tokens than the raw HTML — using only static files. No servers, no RAG
        pipelines, no vector databases.
      </p>
      <p>
        Each sibling has three layers: a <strong>header</strong> (identity + a table of contents, a
        hundred-ish tokens), <strong>facts</strong> (the page&apos;s verifiable data, compactly
        encoded), and <strong>chunks</strong> (each section as plain prose with a stable anchor).
        Agents fetch the header first, decide what they need, then fetch only those chunks — the{" "}
        <em>two-hop retrieval contract</em> you can try in this playground without any API keys.
      </p>
      <p>
        Trust is part of the format: sibling content must be derivable from the human-visible HTML,
        and <code>pageskim validate</code> flags cloaked or injected content, stale hashes, and
        broken anchors.
      </p>

      <h2>Why it works — the evidence</h2>
      <ul>
        <li>
          Raw HTML carries ~67.6% token overhead versus its semantic content (
          <a href="https://arxiv.org/abs/2606.19116">arXiv 2606.19116</a>); plain HTML→markdown
          conversion already yields 5–10x reductions (Cloudflare measured 16,180 → 3,150 tokens on a
          sample post).
        </li>
        <li>
          Removing irrelevant context <em>improves</em> accuracy, not just cost:{" "}
          <a href="https://arxiv.org/abs/2310.05736">LLMLingua</a> and{" "}
          <a href="https://arxiv.org/abs/2310.06839">LongLLMLingua</a> report up to 21.4% accuracy
          gains with ~4x fewer tokens. PageSkim&apos;s layered two-hop design is the
          zero-infrastructure static equivalent.
        </li>
        <li>
          Forcing prose into rigid formats measurably hurts LLM reasoning (
          <a href="https://arxiv.org/abs/2408.02442">arXiv 2408.02442</a>) — so chunks stay plain
          prose, and only genuinely tabular data is tabular (TOON-style encoding, ~40% fewer tokens
          than JSON per <a href="https://toonformat.dev">toonformat.dev</a>).
        </li>
        <li>
          Prompt format can swing accuracy by up to 40% on smaller models with no universal winner (
          <a href="https://arxiv.org/abs/2411.10541">arXiv 2411.10541</a>) — hence the format is
          serialization-flexible: <code>.md</code> and <code>.json</code> are equivalent renderings.
        </li>
      </ul>

      <h2>Free API</h2>
      <p>
        This playground doubles as a free conversion API — <code>POST /api/convert</code> with{" "}
        <code>{'{"html": "..."}'}</code> or <code>{'{"url": "https://..."}'}</code>. Rate-limited,
        CORS-open, nothing stored. Details in the{" "}
        <a href="https://github.com/pageskim/pageskim#playground-api">repository README</a>.
      </p>

      <h2>Links</h2>
      <ul>
        <li>
          <a href="https://github.com/pageskim/pageskim/blob/main/spec/SPEC.md">
            Format spec v0.1
          </a>
        </li>
        <li>
          <a href="https://github.com/pageskim/pageskim">GitHub — spec, CLI, SDK, benchmarks</a>
        </li>
        <li>
          <code>npx pageskim generate your-site/</code> to make your own site agent-readable
        </li>
      </ul>

      <h2>Deploy your own</h2>
      <p>
        <a
          className="deploy-btn"
          href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fpageskim%2Fpageskim&project-name=pageskim-playground&root-directory=apps%2Fplayground"
        >
          ▲ Deploy this playground to Vercel
        </a>
      </p>
      <p style={{ color: "var(--text-soft)", fontSize: 14 }}>
        The playground stores no user content. The aggregate token counter uses Vercel KV when
        available and an in-memory fallback otherwise. There are no analytics beyond that counter.
      </p>
    </article>
  );
}
