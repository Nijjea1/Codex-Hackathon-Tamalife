from __future__ import annotations

import hashlib
import json
import re
from decimal import Decimal, InvalidOperation
from html.parser import HTMLParser
from typing import Any

from pydantic import BaseModel, Field, field_validator

from tamalife_backend.db.models import BillingCycle

EXTRACTION_VERSION = "pricing-html-v1"
MONEY_PATTERN = re.compile(
    r"(?:(?P<currency>USD|CAD|EUR|GBP)\s*|(?P<symbol>[$€£])\s*)"
    r"(?P<amount>\d{1,6}(?:[.,]\d{1,2})?)",
    re.IGNORECASE,
)
CYCLE_PATTERN = re.compile(r"(?:/|per\s+)(month|mo|year|yr|week)", re.IGNORECASE)


class ExtractedPlan(BaseModel):
    external_key: str = Field(min_length=1, max_length=255)
    name: str = Field(min_length=1, max_length=300)
    price: Decimal = Field(ge=0)
    currency: str = Field(min_length=3, max_length=3)
    billing_cycle: BillingCycle
    confidence: float = Field(ge=0, le=1)
    evidence: str = Field(min_length=1, max_length=500)

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        return value.upper()


class ExtractedDeal(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    promotional_price: Decimal | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    evidence: str = Field(min_length=1, max_length=500)
    confidence: float = Field(ge=0, le=1)


class ExtractedPricingCatalog(BaseModel):
    plans: list[ExtractedPlan] = Field(default_factory=list)
    deals: list[ExtractedDeal] = Field(default_factory=list)
    semantic_hash: str
    strategy: str
    version: str = EXTRACTION_VERSION


class _PricingHTMLParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.hidden_depth = 0
        self.json_ld_depth = 0
        self.json_ld: list[str] = []
        self._json_buffer: list[str] = []
        self.text_chunks: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = {key.lower(): (value or "") for key, value in attrs}
        if tag in {"script", "style", "noscript", "svg"}:
            if tag == "script" and attributes.get("type", "").lower() == "application/ld+json":
                self.json_ld_depth += 1
                self._json_buffer = []
            else:
                self.hidden_depth += 1
        if tag in {"p", "div", "li", "tr", "td", "th", "h1", "h2", "h3", "br"}:
            self.text_chunks.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag == "script" and self.json_ld_depth:
            self.json_ld.append("".join(self._json_buffer))
            self._json_buffer = []
            self.json_ld_depth -= 1
        elif tag in {"script", "style", "noscript", "svg"} and self.hidden_depth:
            self.hidden_depth -= 1

    def handle_data(self, data: str) -> None:
        if self.json_ld_depth:
            self._json_buffer.append(data)
        elif not self.hidden_depth:
            self.text_chunks.append(data)


def _cycle(value: str | None, evidence: str) -> BillingCycle:
    raw = (value or "").lower()
    match = CYCLE_PATTERN.search(evidence)
    token = match.group(1).lower() if match else raw
    if "year" in token or token == "yr" or token == "p1y":
        return BillingCycle.yearly
    if "week" in token or token == "p1w":
        return BillingCycle.weekly
    return BillingCycle.monthly


def _currency(symbol_or_code: str | None, default: str) -> str:
    if not symbol_or_code:
        return default.upper()
    return {"€": "EUR", "£": "GBP", "$": default.upper()}.get(
        symbol_or_code.upper(), symbol_or_code.upper()
    )


def _decimal(value: Any) -> Decimal | None:
    try:
        amount = Decimal(str(value).replace(",", "."))
    except (InvalidOperation, ValueError):
        return None
    return amount if amount >= 0 else None


def _json_objects(value: Any) -> list[dict[str, Any]]:
    found: list[dict[str, Any]] = []
    if isinstance(value, dict):
        found.append(value)
        for child in value.values():
            found.extend(_json_objects(child))
    elif isinstance(value, list):
        for child in value:
            found.extend(_json_objects(child))
    return found


def _plans_from_json_ld(parser: _PricingHTMLParser, default_currency: str) -> list[ExtractedPlan]:
    plans: dict[str, ExtractedPlan] = {}
    for raw in parser.json_ld:
        try:
            document = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            continue
        for item in _json_objects(document):
            item_type = str(item.get("@type", "")).lower()
            if item_type not in {"offer", "aggregateoffer"}:
                continue
            amount = _decimal(item.get("price") or item.get("lowPrice"))
            if amount is None:
                continue
            name = str(item.get("name") or item.get("description") or "Plan").strip()[:300]
            currency = _currency(str(item.get("priceCurrency") or ""), default_currency)
            evidence = f"{name} {currency} {amount}"[:500]
            key = hashlib.sha256(f"{name.lower()}:{currency}".encode()).hexdigest()[:32]
            plans[key] = ExtractedPlan(
                external_key=key,
                name=name,
                price=amount,
                currency=currency,
                billing_cycle=_cycle(str(item.get("priceSpecification") or ""), evidence),
                confidence=0.96,
                evidence=evidence,
            )
    return list(plans.values())


def _plans_from_text(text: str, default_currency: str) -> list[ExtractedPlan]:
    plans: dict[str, ExtractedPlan] = {}
    lines = [re.sub(r"\s+", " ", line).strip() for line in text.splitlines()]
    for line in lines:
        if not line or len(line) > 500:
            continue
        match = MONEY_PATTERN.search(line)
        if match is None:
            continue
        amount = _decimal(match.group("amount"))
        if amount is None:
            continue
        prefix = line[: match.start()].strip(" :-")
        name = prefix[-120:].strip() or "Plan"
        currency = _currency(match.group("currency") or match.group("symbol"), default_currency)
        cycle = _cycle(None, line)
        key = hashlib.sha256(f"{name.lower()}:{currency}:{cycle.value}".encode()).hexdigest()[:32]
        plans.setdefault(
            key,
            ExtractedPlan(
                external_key=key,
                name=name,
                price=amount,
                currency=currency,
                billing_cycle=cycle,
                confidence=0.72 if CYCLE_PATTERN.search(line) else 0.58,
                evidence=line,
            ),
        )
    return list(plans.values())


def _deals_from_text(text: str, default_currency: str) -> list[ExtractedDeal]:
    deals: list[ExtractedDeal] = []
    for line in (re.sub(r"\s+", " ", item).strip() for item in text.splitlines()):
        if (
            not line
            or len(line) > 500
            or not re.search(
                r"\b(save|deal|offer|discount|free|student|limited)\b", line, re.IGNORECASE
            )
        ):
            continue
        match = MONEY_PATTERN.search(line)
        amount = _decimal(match.group("amount")) if match else None
        deals.append(
            ExtractedDeal(
                title=line[:500],
                promotional_price=amount,
                currency=_currency(
                    match.group("currency") or match.group("symbol"), default_currency
                )
                if match
                else None,
                evidence=line,
                confidence=0.65,
            )
        )
    return deals[:50]


def extract_pricing_catalog(html: bytes, *, default_currency: str) -> ExtractedPricingCatalog:
    document = html.decode("utf-8", errors="replace")
    parser = _PricingHTMLParser()
    parser.feed(document)
    visible_text = "".join(parser.text_chunks)
    plans = _plans_from_json_ld(parser, default_currency)
    strategy = "json_ld"
    if not plans:
        plans = _plans_from_text(visible_text, default_currency)
        strategy = "visible_text"
    deals = _deals_from_text(visible_text, default_currency)
    semantic_payload = {
        "plans": [plan.model_dump(mode="json", exclude={"evidence"}) for plan in plans],
        "deals": [deal.model_dump(mode="json", exclude={"evidence"}) for deal in deals],
    }
    semantic_hash = hashlib.sha256(
        json.dumps(semantic_payload, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    return ExtractedPricingCatalog(
        plans=plans[:100],
        deals=deals,
        semantic_hash=semantic_hash,
        strategy=strategy,
    )
