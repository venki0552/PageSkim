"use client";

import { useEffect, useRef, useState } from "react";
import type { TokenReport } from "@pageskim/core";
import { dollarsSavedPer1k, MODEL_PRICES, PRICES_AS_OF } from "@/lib/prices";

/** Count-up animation for the hero number. */
function useCountUp(target: number, ms = 900): number {
  const [value, setValue] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const tick = (now: number): void => {
      const t = Math.min((now - start) / ms, 1);
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, ms]);
  return value;
}

function Bar({
  label,
  tokens,
  max,
  kind,
  saving,
}: {
  label: string;
  tokens: number;
  max: number;
  kind: "raw" | "sibling" | "header";
  saving: number | null;
}) {
  const pct = Math.max((tokens / max) * 100, 0.5);
  return (
    <div className="gauge-row">
      <span className="gauge-label">{label}</span>
      <div className="gauge-bar-track">
        <div className={`gauge-bar ${kind}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="gauge-num">
        {tokens.toLocaleString()}
        {saving !== null && (
          <>
            {" "}
            <span className="save">−{saving.toFixed(1)}%</span>
          </>
        )}
      </span>
    </div>
  );
}

export function TokenGauge({ report }: { report: TokenReport }) {
  const saved = report.rawHtml - report.sibling;
  const savedAnimated = useCountUp(saved);
  const siblingPct = (1 - report.sibling / report.rawHtml) * 100;
  const headerPct = (1 - report.headerOnly / report.rawHtml) * 100;

  return (
    <section className="gauge" aria-label="Token savings">
      <div className="stat-hero" role="status" aria-live="polite">
        <span className="big">{savedAnimated.toLocaleString()}</span>
        <span>
          tokens saved on this page
          <br />
          <span className="sub">
            {report.rawHtml.toLocaleString()} as raw HTML → {report.sibling.toLocaleString()} as
            PageSkim ({(report.rawHtml / report.sibling).toFixed(1)}x) → header-only{" "}
            {report.headerOnly.toLocaleString()} ({(report.rawHtml / report.headerOnly).toFixed(0)}x)
          </span>
        </span>
      </div>

      <Bar label="Raw HTML" tokens={report.rawHtml} max={report.rawHtml} kind="raw" saving={null} />
      <Bar label="PageSkim sibling" tokens={report.sibling} max={report.rawHtml} kind="sibling" saving={siblingPct} />
      <Bar label="Header only (hop 1)" tokens={report.headerOnly} max={report.rawHtml} kind="header" saving={headerPct} />

      <details>
        <summary className="counter-line" style={{ cursor: "pointer" }}>
          Per-layer breakdown & $ saved per 1,000 requests
        </summary>
        <table className="mini">
          <thead>
            <tr>
              <th scope="col">Layer</th>
              <th scope="col" style={{ textAlign: "right" }}>
                tokens
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>header</td>
              <td className="num">{report.headerOnly.toLocaleString()}</td>
            </tr>
            <tr>
              <td>facts</td>
              <td className="num">{report.facts.toLocaleString()}</td>
            </tr>
            {report.chunks.map((c) => (
              <tr key={c.id}>
                <td>chunk {c.id}</td>
                <td className="num">{c.tokens.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table className="mini">
          <thead>
            <tr>
              <th scope="col">Model (input price, as of {PRICES_AS_OF})</th>
              <th scope="col" style={{ textAlign: "right" }}>
                $ saved / 1k requests
              </th>
            </tr>
          </thead>
          <tbody>
            {MODEL_PRICES.map((m) => (
              <tr key={m.id}>
                <td>
                  {m.label} (${m.inputPerMTok.toFixed(2)}/MTok)
                </td>
                <td className="num">${dollarsSavedPer1k(saved, m.inputPerMTok).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="counter-line">Token counts: {report.basis}.</p>
      </details>
    </section>
  );
}
