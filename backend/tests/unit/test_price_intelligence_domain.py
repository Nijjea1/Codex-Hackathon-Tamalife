from decimal import Decimal

from tamalife_backend.db.models import BillingCycle
from tamalife_backend.domain.price_intelligence import (
    NormalizedCost,
    deal_is_conservatively_eligible,
    normalize_identity,
    normalized_cost,
    positive_savings,
    score_subscription_plan,
)


def test_identity_normalization_is_unicode_and_punctuation_stable() -> None:
    assert normalize_identity("  NÉT-FLIX™  ") == "netflix"
    assert normalize_identity("NET   FLIX") == "netflix"


def test_cost_and_savings_use_exact_decimal_arithmetic() -> None:
    assert normalized_cost(Decimal("10"), BillingCycle.weekly) == NormalizedCost(
        Decimal("43.33"), Decimal("520.00")
    )
    assert normalized_cost(Decimal("120"), BillingCycle.yearly) == NormalizedCost(
        Decimal("10.00"), Decimal("120.00")
    )
    assert positive_savings(
        NormalizedCost(Decimal("20.00"), Decimal("240.00")),
        NormalizedCost(Decimal("12.50"), Decimal("150.00")),
    ) == NormalizedCost(Decimal("7.50"), Decimal("90.00"))


def test_matching_reasons_are_deterministic() -> None:
    score = score_subscription_plan(
        vendor_name="Stream Flix",
        display_name="Premium",
        amount=Decimal("19.99"),
        currency="CAD",
        billing_cycle=BillingCycle.monthly,
        provider_names=("Stream Flix", "streamflix"),
        plan_name="Premium",
        plan_price=Decimal("19.99"),
        plan_currency="CAD",
        plan_billing_cycle=BillingCycle.monthly,
    )
    assert score.confidence == 1.0
    assert score.reason_codes == (
        "provider_exact",
        "plan_name_exact",
        "currency_match",
        "cycle_match",
        "price_exact",
    )


def test_deal_eligibility_defaults_to_conservative() -> None:
    assert deal_is_conservatively_eligible({})
    assert deal_is_conservatively_eligible({"all_customers": True})
    assert not deal_is_conservatively_eligible({"new_customers_only": True})
    assert not deal_is_conservatively_eligible({"student": True})
