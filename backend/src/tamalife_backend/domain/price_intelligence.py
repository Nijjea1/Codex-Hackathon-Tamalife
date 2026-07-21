from __future__ import annotations

import unicodedata
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from tamalife_backend.db.models import BillingCycle

CENT = Decimal("0.01")


@dataclass(frozen=True)
class NormalizedCost:
    monthly: Decimal
    annual: Decimal


@dataclass(frozen=True)
class MatchScore:
    confidence: float
    reason_codes: tuple[str, ...]


def normalize_identity(value: str) -> str:
    without_symbols = "".join(
        character
        for character in value
        if not unicodedata.category(character).startswith(("P", "S"))
    )
    decomposed = unicodedata.normalize("NFKD", without_symbols).casefold()
    return "".join(
        character
        for character in decomposed
        if character.isalnum() and not unicodedata.combining(character)
    )


def normalized_cost(amount: Decimal, cycle: BillingCycle) -> NormalizedCost:
    annual_factors = {
        BillingCycle.weekly: Decimal("52"),
        BillingCycle.monthly: Decimal("12"),
        BillingCycle.yearly: Decimal("1"),
        BillingCycle.one_time: Decimal("0"),
        BillingCycle.trial: Decimal("0"),
    }
    annual_raw = amount * annual_factors[cycle]
    monthly_raw = annual_raw / Decimal("12")
    return NormalizedCost(
        monthly=monthly_raw.quantize(CENT, rounding=ROUND_HALF_UP),
        annual=annual_raw.quantize(CENT, rounding=ROUND_HALF_UP),
    )


def positive_savings(current: NormalizedCost, alternative: NormalizedCost) -> NormalizedCost:
    return NormalizedCost(
        monthly=max(current.monthly - alternative.monthly, Decimal("0.00")).quantize(CENT),
        annual=max(current.annual - alternative.annual, Decimal("0.00")).quantize(CENT),
    )


def score_subscription_plan(
    *,
    vendor_name: str,
    display_name: str,
    amount: Decimal,
    currency: str,
    billing_cycle: BillingCycle,
    provider_names: tuple[str, ...],
    plan_name: str,
    plan_price: Decimal,
    plan_currency: str,
    plan_billing_cycle: BillingCycle,
) -> MatchScore:
    vendor = normalize_identity(vendor_name)
    display = normalize_identity(display_name)
    normalized_providers = {normalize_identity(name) for name in provider_names if name}
    normalized_plan = normalize_identity(plan_name)
    confidence = Decimal("0")
    reasons: list[str] = []

    if vendor and vendor in normalized_providers:
        confidence += Decimal("0.55")
        reasons.append("provider_exact")
    elif vendor and any(vendor in name or name in vendor for name in normalized_providers):
        confidence += Decimal("0.35")
        reasons.append("provider_partial")

    if display and normalized_plan and display == normalized_plan:
        confidence += Decimal("0.20")
        reasons.append("plan_name_exact")
    elif display and normalized_plan and (display in normalized_plan or normalized_plan in display):
        confidence += Decimal("0.10")
        reasons.append("plan_name_partial")

    if currency.upper() == plan_currency.upper():
        confidence += Decimal("0.05")
        reasons.append("currency_match")
    if billing_cycle is plan_billing_cycle:
        confidence += Decimal("0.05")
        reasons.append("cycle_match")

    subscription_cost = normalized_cost(amount, billing_cycle)
    plan_cost = normalized_cost(plan_price, plan_billing_cycle)
    if subscription_cost.monthly == plan_cost.monthly:
        confidence += Decimal("0.15")
        reasons.append("price_exact")
    elif subscription_cost.monthly > 0:
        variance = abs(subscription_cost.monthly - plan_cost.monthly) / subscription_cost.monthly
        if variance <= Decimal("0.05"):
            confidence += Decimal("0.10")
            reasons.append("price_close")

    return MatchScore(float(min(confidence, Decimal("1"))), tuple(reasons))


def deal_is_conservatively_eligible(eligibility: dict[str, object]) -> bool:
    if not eligibility:
        return True
    return eligibility == {"all_customers": True}
