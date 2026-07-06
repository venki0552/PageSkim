"use client";

import { useMemo, useRef, useState } from "react";
import type { ConvertPayload } from "@/worker/protocol";
import { highlightJson, highlightMd } from "@/lib/highlight";
import { buildZip } from "@/lib/zip";
import { CheckIcon, CopyIcon, DownloadIcon } from "@/components/Icons";

const TABS = ["llm.md", "llm.json", "split files", "extracted"] as const;
type Tab = (typeof TABS)[number];

function download(name: string, data: Uint8Array | string, type: string): void {
  const blob =
    typeof data === "string"
      ? new Blob([data], { type })
      : new Blob([data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function OutputTabs({ result }: { result: ConvertPayload }) {
  const [tab, setTab] = useState<Tab>("llm.md");
  const [copied, setCopied] = useState(false);
  const tablistRef = useRef<HTMLDivElement>(null);

  const extracted = useMemo(
    () =>
      result.doc.chunks
        .map((c) => `── ${c.id} ${"─".repeat(Math.max(1, 40 - c.id.length))}\n${c.text}`)
        .join("\n\n"),
    [result],
  );

  const current: { text: string; html?: string } = useMemo(() => {
    switch (tab) {
      case "llm.md":
        return { text: result.llmMd, html: highlightMd(result.llmMd) };
      case "llm.json":
        return { text: result.llmJson, html: highlightJson(result.llmJson) };
      case "extracted":
        return { text: extracted };
      default:
        return { text: "" };
    }
  }, [tab, result, extracted]);

  const copy = (): void => {
    void navigator.clipboard.writeText(current.text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const onKeyDown = (e: React.KeyboardEvent): void => {
    const idx = TABS.indexOf(tab);
    if (e.key === "ArrowRight") setTab(TABS[(idx + 1) % TABS.length]!);
    if (e.key === "ArrowLeft") setTab(TABS[(idx - 1 + TABS.length) % TABS.length]!);
  };

  return (
    <div>
      <div className="tabs" role="tablist" aria-label="Output format" ref={tablistRef} onKeyDown={onKeyDown}>
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            tabIndex={tab === t ? 0 : -1}
            className="tab"
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
        <div className="tab-actions">
          {tab !== "split files" && (
            <button type="button" className="btn-secondary" onClick={copy}>
              {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
              {copied ? "Copied!" : "Copy"}
            </button>
          )}
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              if (tab === "split files") {
                download("page.llm.zip", buildZip(result.splitFiles), "application/zip");
              } else if (tab === "llm.json") {
                download("page.llm.json", result.llmJson, "application/json");
              } else {
                download("page.llm.md", current.text, "text/markdown");
              }
            }}
          >
            <DownloadIcon size={13} />
            Download{tab === "split files" ? " zip" : ""}
          </button>
        </div>
      </div>

      {tab === "split files" ? (
        <div className="split-list" role="tabpanel">
          {Object.entries(result.splitFiles).map(([name, content]) => (
            <div key={name} className="split-item">
              <span>page.llm/{name}</span>
              <span>
                {content.length.toLocaleString()} bytes{" "}
                <button
                  type="button"
                  className="btn-secondary"
                  aria-label={`Download ${name}`}
                  onClick={() => download(name, content, "text/markdown")}
                >
                  <DownloadIcon size={13} />
                </button>
              </span>
            </div>
          ))}
        </div>
      ) : current.html ? (
        <pre className="output" role="tabpanel" dangerouslySetInnerHTML={{ __html: current.html }} />
      ) : (
        <pre className="output" role="tabpanel">
          {current.text}
        </pre>
      )}
    </div>
  );
}
