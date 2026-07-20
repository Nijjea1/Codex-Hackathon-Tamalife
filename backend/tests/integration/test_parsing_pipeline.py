from pathlib import Path
from typing import Any
from uuid import UUID

import httpx

from tamalife_backend.config import Settings
from tamalife_backend.main import create_app
from tamalife_backend.schemas import ExtractedReceipt
from tamalife_backend.services.extraction import ExtractionResult


def extracted_payload() -> ExtractedReceipt:
    return ExtractedReceipt.model_validate(
        {
            "display_name": "Northstar Video",
            "vendor_name": "Northstar Video",
            "item_type": "subscription",
            "category": "Entertainment",
            "amount": "19.99",
            "previous_amount": "17.99",
            "currency": "USD",
            "billing_cycle": "monthly",
            "renewal_or_expiry_date": "2026-08-12",
            "cancellation_difficulty": "moderate",
            "confidence": 0.97,
            "evidence": [],
        }
    )


class RepairingExtractor:
    def __init__(self) -> None:
        self.repairs: list[bool] = []

    async def extract_text(self, text: str, *, repair: bool = False) -> ExtractionResult:
        del text
        self.repairs.append(repair)
        if not repair:
            raise ValueError("invalid initial extraction")
        return ExtractionResult(extracted_payload(), {"provider": "raw", "attempt": 2})

    async def extract_image(
        self, data: bytes, content_type: str, *, repair: bool = False
    ) -> ExtractionResult:
        del data, content_type, repair
        raise AssertionError("not used")

    async def extract_document(
        self, data: bytes, content_type: str, *, repair: bool = False
    ) -> ExtractionResult:
        del data, content_type, repair
        raise AssertionError("not used")


class FailingExtractor(RepairingExtractor):
    async def extract_text(self, text: str, *, repair: bool = False) -> ExtractionResult:
        del text, repair
        raise RuntimeError("provider secret must not reach the response")


async def post_with_extractor(tmp_path: Path, extractor: Any) -> tuple[dict[str, Any], Any]:
    settings = Settings(
        environment="test",
        database_url=f"sqlite+aiosqlite:///{(tmp_path / 'parse.db').as_posix()}",
        local_storage_root=tmp_path / "storage",
        auto_create_schema=True,
        clerk_auth_enabled=False,
        cache_enabled=False,
    )
    app = create_app(settings)
    async with app.router.lifespan_context(app):
        app.state.extractor = extractor
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post("/v1/parse", data={"text": "anonymized receipt"})
            assert response.status_code == 200
            return response.json(), app


async def test_retries_with_repair_prompt_and_preserves_raw_response(tmp_path: Path) -> None:
    extractor = RepairingExtractor()
    response, app = await post_with_extractor(tmp_path, extractor)
    assert response["status"] == "completed"
    assert extractor.repairs == [False, True]

    async with app.state.session_factory() as session:
        from tamalife_backend.db.models import ParsedReceipt

        receipt = await session.get(ParsedReceipt, UUID(response["id"]))
        assert receipt is not None
        assert receipt.raw_model_response == {"provider": "raw", "attempt": 2}


async def test_provider_failure_is_durable_and_redacted(tmp_path: Path) -> None:
    response, _app = await post_with_extractor(tmp_path, FailingExtractor())
    assert response["status"] == "failed"
    assert response["validation_errors"] == [{"attempt": 1, "message": "RuntimeError"}]
