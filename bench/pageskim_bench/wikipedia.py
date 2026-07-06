"""Wikipedia article fetcher (REST API) with disk snapshots. stdlib-only."""

from __future__ import annotations

import urllib.request
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
USER_AGENT = "PageSkimBench/0.1 (+https://github.com/venki0552/PageSkim)"


def fetch_article_html(title: str, data_dir: Path | None = None) -> str:
    """Fetch (or reuse the snapshot of) one article's HTML."""
    directory = (data_dir or DATA_DIR) / "articles"
    directory.mkdir(parents=True, exist_ok=True)
    safe = title.replace("/", "_")
    path = directory / f"{safe}.html"
    if path.exists():
        return path.read_text()
    url = f"https://en.wikipedia.org/api/rest_v1/page/html/{urllib.parse.quote(title, safe='')}"
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        html = response.read().decode("utf-8")
    path.write_text(html)
    return html


def default_titles(data_dir: Path | None = None) -> list[str]:
    path = (data_dir or DATA_DIR) / "titles.txt"
    return [t.strip() for t in path.read_text().splitlines() if t.strip() and not t.startswith("#")]
