/**
 * <pageskim-badge> — a tiny embeddable widget:
 * "This page: X tokens as HTML → Y as PageSkim (Z% saved)" with a copy button.
 *
 * Defined lazily so importing this module is SSR-safe (no HTMLElement at
 * module scope). Call definePageskimBadge() in the browser, or load the
 * <script> build, which calls it automatically.
 */

import { fromDocument, tokenBasis, type PageSkimResult } from "./api.js";

export function definePageskimBadge(): void {
  if (typeof window === "undefined" || typeof customElements === "undefined") return;
  if (customElements.get("pageskim-badge")) return;

  class PageskimBadge extends HTMLElement {
    private result: PageSkimResult | null = null;

    connectedCallback(): void {
      const render = (): void => {
        try {
          this.result = fromDocument(document);
        } catch {
          this.render(null);
          return;
        }
        this.render(this.result);
      };
      if (document.readyState === "complete" || document.readyState === "interactive") {
        // Let the page settle so we measure the hydrated DOM.
        setTimeout(render, 0);
      } else {
        document.addEventListener("DOMContentLoaded", () => setTimeout(render, 0), { once: true });
      }
    }

    private render(result: PageSkimResult | null): void {
      const root = this.shadowRoot ?? this.attachShadow({ mode: "open" });
      const style = `
        :host { display: inline-block; font: 12px/1.4 system-ui, sans-serif; }
        .badge { display: inline-flex; gap: 8px; align-items: center; border: 1px solid #8884;
                 border-radius: 8px; padding: 6px 10px; }
        .num { font-weight: 700; }
        .saved { color: #0a7a3d; font-weight: 700; }
        button { border: 1px solid #8886; background: transparent; border-radius: 6px;
                 padding: 2px 8px; cursor: pointer; font: inherit; color: inherit; }
        @media (prefers-color-scheme: dark) { .saved { color: #4ade80; } }
      `;
      if (!result) {
        root.innerHTML = `<style>${style}</style><span class="badge">PageSkim: no content extracted</span>`;
        return;
      }
      const { rawHtml, sibling } = result.tokenReport;
      const pct = Math.round((1 - sibling / rawHtml) * 100);
      root.innerHTML = `<style>${style}</style>
        <span class="badge" title="${escapeAttr(tokenBasis())}">
          <span>This page: <span class="num">${rawHtml.toLocaleString()}</span> tokens as HTML →
          <span class="num">${sibling.toLocaleString()}</span> as PageSkim
          <span class="saved">(${pct}% saved)</span></span>
          <button type="button">Copy .llm.md</button>
        </span>`;
      root.querySelector("button")?.addEventListener("click", () => {
        void navigator.clipboard.writeText(result.llmMd).then(() => {
          const b = root.querySelector("button");
          if (b) {
            b.textContent = "Copied!";
            setTimeout(() => (b.textContent = "Copy .llm.md"), 1500);
          }
        });
      });
    }
  }

  customElements.define("pageskim-badge", PageskimBadge);
}

function escapeAttr(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}
