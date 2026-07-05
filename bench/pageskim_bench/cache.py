"""Disk cache for provider calls, keyed by SHA-256 of the request payload."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from .providers import Completion, Provider

CACHE_DIR = Path(__file__).resolve().parent.parent / ".cache"


class CachedProvider:
    """Wraps any Provider with a write-through disk cache."""

    def __init__(self, inner: Provider, cache_dir: Path | None = None) -> None:
        self.inner = inner
        self.name = inner.name
        self.dir = cache_dir or CACHE_DIR
        self.hits = 0
        self.misses = 0

    def _key(self, system: str, prompt: str) -> Path:
        payload = json.dumps(
            {"provider": self.inner.name, "system": system, "prompt": prompt},
            sort_keys=True,
            ensure_ascii=False,
        )
        digest = hashlib.sha256(payload.encode()).hexdigest()
        return self.dir / f"{digest}.json"

    def complete(self, system: str, prompt: str) -> Completion:
        path = self._key(system, prompt)
        if path.exists():
            self.hits += 1
            data = json.loads(path.read_text())
            return Completion(**data)
        self.misses += 1
        result = self.inner.complete(system, prompt)
        self.dir.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(
                {
                    "text": result.text,
                    "input_tokens": result.input_tokens,
                    "output_tokens": result.output_tokens,
                },
                ensure_ascii=False,
            )
        )
        return result
