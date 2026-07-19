import json
from pathlib import Path

from tamalife_backend.schemas import ExtractedReceipt
from tamalife_backend.services.extraction import HeuristicExtractor


def test_recorded_extraction_contract() -> None:
    value = ExtractedReceipt.model_validate(
        {
            "display_name": "Video Streaming",
            "vendor_name": "StreamFlix",
            "item_type": "subscription",
            "category": "Entertainment",
            "amount": "19.99",
            "previous_amount": "17.99",
            "currency": "USD",
            "billing_cycle": "monthly",
            "renewal_or_expiry_date": "2026-08-12",
            "cancellation_difficulty": "moderate",
            "confidence": 0.97,
            "evidence": [{"label": "New price", "snippet": "now $19.99"}],
        }
    )
    assert value.vendor_name == "StreamFlix"


async def test_prompt_version_fixture_accuracy() -> None:
    fixture_path = (
        Path(__file__).parents[1] / "fixtures" / "receipts" / "streaming_price_increase.json"
    )
    fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
    result = await HeuristicExtractor().extract_text(fixture["input"])
    expected = fixture["expected"]
    assert result.parsed.vendor_name == expected["vendor_name"]
    assert str(result.parsed.amount) == expected["amount"]
    assert str(result.parsed.previous_amount) == expected["previous_amount"]
    assert result.parsed.billing_cycle.value == expected["billing_cycle"]
    assert result.parsed.renewal_or_expiry_date.isoformat() == expected["renewal_or_expiry_date"]
    assert result.raw_response["vendor_name"] == expected["vendor_name"]
