import type { Metadata } from "next";
import Link from "next/link";
import { GitHubIcon, LogoIcon, MoonIcon, SunIcon } from "@/components/Icons";
import "./globals.css";

const SITE_URL = "https://page-skim.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "PageSkim Playground — make any page readable by agents",
  description:
    "Paste HTML or a URL and watch it become a compact .llm.md sibling: 10-50x fewer tokens for LLMs and agents, with a live savings counter.",
  openGraph: {
    title: "PageSkim — make any page readable by agents",
    description:
      "10–50x fewer tokens for LLMs and agents, with static files only. Try the live converter and two-hop simulator.",
    url: SITE_URL,
    siteName: "PageSkim Playground",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PageSkim — make any page readable by agents",
    description: "10–50x fewer tokens for LLMs and agents, with static files only.",
  },
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
            <LogoIcon size={22} className="brand-mark" /> PageSkim{" "}
            <span className="badge-mini">playground</span>
          </Link>
          <nav aria-label="Site">
            <Link href="/">Convert</Link>
            <Link href="/about">About</Link>
            <a href="https://github.com/venki0552/PageSkim" rel="noopener" className="nav-icon-link">
              <GitHubIcon size={15} /> GitHub
            </a>
            <button type="button" className="theme-toggle" aria-label="Toggle dark mode" data-theme-toggle>
              <span className="icon-moon">
                <MoonIcon size={15} />
              </span>
              <span className="icon-sun">
                <SunIcon size={15} />
              </span>
            </button>
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
