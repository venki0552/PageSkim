import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "PageSkim Playground — make any page readable by agents",
  description:
    "Paste HTML or a URL and watch it become a compact .llm.md sibling: 10-50x fewer tokens for LLMs and agents, with a live savings counter.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script
          // Set theme before paint; respects system preference by default.
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("ps-theme");if(t)document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
        <header className="site-header">
          <Link href="/" className="brand">
            <span aria-hidden="true">⤵</span> PageSkim <span className="badge-mini">playground</span>
          </Link>
          <nav aria-label="Site">
            <Link href="/">Convert</Link>
            <Link href="/about">About</Link>
            <a href="https://github.com/pageskim/pageskim" rel="noopener">
              GitHub
            </a>
            <button
              type="button"
              className="theme-toggle"
              aria-label="Toggle dark mode"
              // Toggle relative to the currently applied theme.
              dangerouslySetInnerHTML={{ __html: "◐" }}
              data-theme-toggle
            />
          </nav>
        </header>
        <script
          dangerouslySetInnerHTML={{
            __html: `document.querySelector("[data-theme-toggle]").addEventListener("click",function(){var r=document.documentElement;var cur=r.dataset.theme||(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");var next=cur==="dark"?"light":"dark";r.dataset.theme=next;try{localStorage.setItem("ps-theme",next)}catch(e){}});`,
          }}
        />
        <main>{children}</main>
        <footer className="site-footer">
          <p>
            No page content is stored — conversions run in your browser (paste mode) or in-memory on
            the server (URL mode). The only thing counted is the aggregate token total.
          </p>
        </footer>
      </body>
    </html>
  );
}
