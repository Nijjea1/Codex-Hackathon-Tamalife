from __future__ import annotations

from collections import Counter
from typing import Any


class Metrics:
    def __init__(self) -> None:
        self._counters: Counter[str] = Counter()

    def increment(self, name: str) -> None:
        self._counters[name] += 1

    def snapshot(self) -> dict[str, Any]:
        attempts = self._counters["receipt_parse_attempts_total"]
        successes = self._counters["receipt_parse_successes_total"]
        return {
            **dict(self._counters),
            "receipt_parse_success_ratio": successes / attempts if attempts else None,
        }
