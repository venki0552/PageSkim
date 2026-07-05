"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EXAMPLES } from "@/generated/examples";
import { OutputTabs } from "@/components/OutputTabs";
import { TokenGauge } from "@/components/TokenGauge";
import { TwoHop } from "@/components/TwoHop";
import type { ConvertPayload, ConvertResponse } from "@/worker/protocol";

type Mode = "paste" | "url";

interface Stats {
  conversions: number;
  tokensSaved: number;
}

export default function Playground() {
  const [mode, setMode] = useState<Mode>("paste");
  const [html, setHtml] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConvertPayload | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL("../worker/convert.worker.ts", import.meta.url));
    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  useEffect(() => {
    void fetch("/api/stats")
      .then((r) => r.json())
      .then((s: Stats) => setStats(s))
      .catch(() => {});
  }, [result]);

  const convertHtml = useCallback((input: string) => {
    const worker = workerRef.current;
    if (!worker) return;
    setBusy(true);
    setError(null);
    worker.onmessage = (event: MessageEvent<ConvertResponse>) => {
      setBusy(false);
      if (event.data.kind === "error") {
        setError(event.data.message);
        setResult(null);
        return;
      }
      const payload = event.data.payload;
      setResult(payload);
      // Feed the aggregate counter (numbers only, never content).
      void fetch("/api/stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saved: payload.tokenReport.rawHtml - payload.tokenReport.sibling }),
      }).catch(() => {});
    };
    worker.postMessage({ kind: "convert", html: input });
  }, []);

  const convertUrl = useCallback(async (input: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: input }),
      });
      const data = (await res.json()) as
        | ConvertPayload
        | { error: { code: string; message: string } };
      if ("error" in data) {
        setError(data.error.message);
        setResult(null);
      } else {
        setResult(data);
      }
    } catch {
      setError("Network error talking to /api/convert.");
    } finally {
      setBusy(false);
    }
  }, []);

  const onConvert = (): void => {
    if (mode === "paste") {
      if (html.trim() === "") {
        setError("Paste some HTML first (or try an example).");
        return;
      }
      convertHtml(html);
    } else {
      if (url.trim() === "") {
        setError("Enter a URL first.");
        return;
      }
      void convertUrl(url.trim());
    }
  };

  return (
    <>
      <h1>Make any page readable by agents — at 10–50x fewer tokens</h1>
      <p className="tagline">
        Paste HTML or fetch a URL. PageSkim strips the boilerplate, keeps the content, and emits a
        compact <code>.llm.md</code> sibling any LLM can navigate in two hops.
      </p>

      <div className="layout">
        <section className="panel" aria-label="Input">
          <h2>Input</h2>
          <div className="mode-row" role="group" aria-label="Input mode">
            <button type="button" className="chip" aria-pressed={mode === "paste"} onClick={() => setMode("paste")}>
              Paste HTML
            </button>
            <button type="button" className="chip" aria-pressed={mode === "url"} onClick={() => setMode("url")}>
              Fetch URL
            </button>
          </div>

          {mode === "paste" ? (
            <>
              <textarea
                className="html-input"
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                placeholder="<!DOCTYPE html>…  (paste a whole page here)"
                aria-label="HTML to convert"
              />
              <div className="mode-row" style={{ marginTop: 8 }}>
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex.id}
                    type="button"
                    className="chip"
                    onClick={() => {
                      setMode("paste");
                      setHtml(ex.html);
                      convertHtml(ex.html);
                    }}
                  >
                    Try: {ex.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <input
                className="url-input"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://en.wikipedia.org/wiki/Lighthouse_of_Alexandria"
                aria-label="URL to fetch and convert"
                onKeyDown={(e) => {
                  if (e.key === "Enter") onConvert();
                }}
              />
              <p style={{ fontSize: 13, color: "var(--text-soft)" }}>
                Fetched server-side as <code>PageSkimBot/0.1</code>, respecting robots.txt, 5&nbsp;MB
                cap. Blocked or client-rendered page? Paste its rendered HTML instead (copy{" "}
                <code>document.documentElement.outerHTML</code> from the browser console).
              </p>
            </>
          )}

          <div style={{ marginTop: 12 }}>
            <button type="button" className="btn" onClick={onConvert} disabled={busy}>
              {busy ? "Converting…" : "Convert →"}
            </button>
          </div>

          {error && (
            <div className="error-box" role="alert">
              {error}
            </div>
          )}

          {stats && (
            <p className="counter-line">
              Tokens saved by this playground so far:{" "}
              <strong>{stats.tokensSaved.toLocaleString()}</strong> across{" "}
              <strong>{stats.conversions.toLocaleString()}</strong> conversions. No page content is
              stored — just this counter.
            </p>
          )}
        </section>

        <section className="panel" aria-label="Output">
          <h2>Output</h2>
          {result ? (
            <>
              <TokenGauge report={result.tokenReport} />
              <OutputTabs result={result} />
            </>
          ) : (
            <p style={{ color: "var(--text-soft)" }}>
              Convert a page to see its sibling, the token gauge, and the two-hop simulator. The
              fastest way in: hit one of the example buttons.
            </p>
          )}
        </section>
      </div>

      {result && <TwoHop result={result} />}
    </>
  );
}
