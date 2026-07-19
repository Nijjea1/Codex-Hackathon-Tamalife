from tamalife_backend.schemas import ExtractedReceipt


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
