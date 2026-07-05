"use client";

import { useMemo, useState } from "react";
import type { TokenReport } from "@pageskim/core";
import type { ConvertPayload } from "@/worker/protocol";
import { rankChunks, selectChunks } from "@/lib/bm25";

function chunkTokens(report: TokenReport, id: string): number {
  return report.chunks.find((c) => c.id === id)?.tokens ?? 0;
}

export function TwoHop({ result }: { result: ConvertPayload }) {
  const [question, setQuestion] = useState("");

  const sim = useMemo(() => {
    if (question.trim().length < 3) return null;
    const ranked = rankChunks(result.doc, question);
    const selected = selectChunks(ranked);
    const hop1 = result.tokenReport.headerOnly;
    const hop2 = selected.reduce((sum, id) => sum + chunkTokens(result.tokenReport, id), 0);
    return { selected: new Set(selected), hop1, hop2, total: hop1 + hop2 };
  }, [question, result]);

  return (
    <section className="panel" aria-label="Two-hop retrieval simulator" style={{ marginTop: 20 }}>
      <h2>Two-hop simulator — no LLM, no API keys</h2>
      <p style={{ marginTop: 0, fontSize: 14, color: "var(--text-soft)" }}>
        An agent fetches the tiny header first, picks chunks from the TOC, then fetches only those.
        Type a question to see which chunks a keyword scorer (BM25-lite, in your browser) would pull.
      </p>
      <input
        className="url-input"
        type="text"
        placeholder='e.g. "how tall was the lighthouse?"'
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        aria-label="Question for the two-hop simulator"
      />
      {sim && (
        <div className="hop-flow">
          <div className="hop-card">
            <h3>Hop 1 — fetch the header</h3>
            <span className="gauge-num">{sim.hop1.toLocaleString()} tokens</span> — enough to decide
            which chunks matter.
          </div>
          <div className="hop-card">
            <h3>Hop 2 — fetch only the selected chunks</h3>
            <div className="hop-chunks">
              {result.doc.chunks.map((c) => (
                <span key={c.id} className={`hop-chunk${sim.selected.has(c.id) ? " selected" : ""}`}>
                  {c.id} ({chunkTokens(result.tokenReport, c.id).toLocaleString()})
                </span>
              ))}
            </div>
            <p className="gauge-num" style={{ textAlign: "left", marginBottom: 0 }}>
              {sim.hop2.toLocaleString()} tokens
            </p>
          </div>
          <p className="hop-total">
            Two-hop total: <strong>{sim.total.toLocaleString()} tokens</strong> vs{" "}
            {result.tokenReport.sibling.toLocaleString()} for the full sibling vs{" "}
            {result.tokenReport.rawHtml.toLocaleString()} for the raw page —{" "}
            <strong>{(result.tokenReport.rawHtml / sim.total).toFixed(0)}x less</strong> than sending
            the HTML.
          </p>
        </div>
      )}
    </section>
  );
}
