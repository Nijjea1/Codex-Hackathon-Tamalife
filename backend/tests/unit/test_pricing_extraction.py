from decimal import Decimal

from tamalife_backend.db.models import BillingCycle
from tamalife_backend.services.pricing_extraction import extract_pricing_catalog


def test_extracts_structured_json_ld_before_visible_text() -> None:
    html = b"""
    <html><head><script type="application/ld+json">
    {"@type":"Offer","name":"Premium","price":"19.99","priceCurrency":"CAD"}
    </script></head><body><div>Ignore $999 / month</div></body></html>
    """
    result = extract_pricing_catalog(html, default_currency="CAD")
    assert result.strategy == "json_ld"
    assert len(result.plans) == 1
    assert result.plans[0].name == "Premium"
    assert result.plans[0].price == Decimal("19.99")
    assert result.plans[0].currency == "CAD"


def test_extracts_visible_plan_cycles_and_deals_deterministically() -> None:
    html = b"""
    <table><tr><th>Basic</th><td>$9.99 per month</td></tr></table>
    <p>Student offer: save now for $4.99 / mo</p>
    <script>const fake = '$1000 per month';</script>
    """
    first = extract_pricing_catalog(html, default_currency="CAD")
    second = extract_pricing_catalog(html, default_currency="CAD")
    assert first == second
    assert first.semantic_hash == second.semantic_hash
    assert [plan.billing_cycle for plan in first.plans] == [
        BillingCycle.monthly,
        BillingCycle.monthly,
    ]
    assert all(plan.price < 100 for plan in first.plans)
    assert len(first.deals) == 1


def test_malformed_json_ld_falls_back_without_executing_page_content() -> None:
    html = b"""
    <script type="application/ld+json">not-json</script>
    <style>.price { content: '$500'; }</style>
    <div>Annual plan GBP 79.00 per year</div>
    """
    result = extract_pricing_catalog(html, default_currency="GBP")
    assert result.strategy == "visible_text"
    assert result.plans[0].price == Decimal("79.00")
    assert result.plans[0].currency == "GBP"
    assert result.plans[0].billing_cycle is BillingCycle.yearly


def test_empty_or_unpriced_pages_return_stable_empty_catalog() -> None:
    result = extract_pricing_catalog(b"<h1>Contact sales</h1>", default_currency="CAD")
    assert result.plans == []
    assert result.deals == []
    assert len(result.semantic_hash) == 64
