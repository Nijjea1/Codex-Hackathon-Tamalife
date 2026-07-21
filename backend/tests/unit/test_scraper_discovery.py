from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import func, select

from tamalife_backend.config import Settings
from tamalife_backend.db.models import (
    CandidateStatus,
    DiscoveryStatus,
    PricingSource,
    Provider,
    SourceCandidate,
    SourceDiscoveryRun,
)
from tamalife_backend.db.session import create_engine, create_schema, create_session_factory
from tamalife_backend.services.scraper_discovery import (
    DiscoveredSource,
    DiscoveryPayload,
    discover_provider_sources,
)


class FakeResponse:
    def __init__(self, *, grounded: bool = True) -> None:
        self.output_parsed = DiscoveryPayload(
            candidates=[
                DiscoveredSource(
                    url="https://example.com/pricing",
                    source_type="pricing",
                    title="Plans",
                    country="CA",
                    currency="CAD",
                    first_party=True,
                    confidence=0.98,
                ),
                DiscoveredSource(
                    url="https://untrusted.example/deal",
                    source_type="promotion",
                    country="CA",
                    first_party=False,
                    confidence=0.4,
                ),
            ]
        )
        self.grounded = grounded

    def model_dump(self, *, mode: str, warnings: bool = True) -> dict[str, Any]:
        assert mode == "json"
        assert warnings is False
        sources = [{"type": "url", "url": "https://example.com/pricing"}]
        if not self.grounded:
            sources = []
        return {
            "id": "resp_test",
            "output": [{"type": "web_search_call", "action": {"sources": sources}}],
            "usage": {"input_tokens": 20, "output_tokens": 10},
        }


class FakeResponses:
    def __init__(self, response: FakeResponse | Exception) -> None:
        self.response = response
        self.calls: list[dict[str, Any]] = []

    async def parse(self, **kwargs: Any) -> FakeResponse:
        self.calls.append(kwargs)
        if isinstance(self.response, Exception):
            raise self.response
        return self.response


class FakeClient:
    def __init__(self, response: FakeResponse | Exception) -> None:
        self.responses = FakeResponses(response)


async def _database(tmp_path: Path):  # type: ignore[no-untyped-def]
    settings = Settings(
        environment="test",
        clerk_auth_enabled=False,
        discovery_enabled=True,
        openai_api_key="test-key",
        database_url=f"sqlite+aiosqlite:///{(tmp_path / 'discovery.db').as_posix()}",
    )
    engine = create_engine(settings)
    await create_schema(engine)
    return settings, engine, create_session_factory(engine)


async def test_discovery_persists_only_grounded_candidates_and_is_monthly_idempotent(
    tmp_path: Path,
) -> None:
    settings, engine, factory = await _database(tmp_path)
    client = FakeClient(FakeResponse())
    now = datetime(2026, 7, 20, tzinfo=UTC)
    async with factory() as session:
        provider = Provider(
            name="Example Music",
            slug="example",
            official_domain="example.com",
            category="Entertainment",
        )
        session.add(provider)
        await session.commit()

        first = await discover_provider_sources(
            session, settings, provider.id, request_id="req-1", client=client, now=now
        )
        await session.commit()
        second = await discover_provider_sources(
            session, settings, provider.id, request_id="req-2", client=client, now=now
        )

        assert first.status is DiscoveryStatus.completed
        assert first.candidate_count == 1
        assert second.created is False
        assert second.run_id == first.run_id
        assert len(client.responses.calls) == 1
        call = client.responses.calls[0]
        assert call["store"] is False
        assert call["include"] == ["web_search_call.action.sources"]
        assert call["max_tool_calls"] == settings.discovery_max_searches_per_provider
        request_text = call["input"][1]["content"]
        assert "Subscription category: Entertainment" in request_text
        assert "music" in request_text
        candidates = list((await session.scalars(select(SourceCandidate))).all())
        assert [item.candidate_domain for item in candidates] == ["example.com"]
        assert candidates[0].status is CandidateStatus.active
        source = await session.scalar(select(PricingSource))
        assert source is not None
        assert source.canonical_url == "https://example.com/pricing"
    await engine.dispose()


async def test_discovery_records_sanitized_failure_without_deleting_sources(tmp_path: Path) -> None:
    settings, engine, factory = await _database(tmp_path)
    client = FakeClient(RuntimeError("secret upstream body"))
    async with factory() as session:
        provider = Provider(name="Example", slug="example")
        session.add(provider)
        await session.commit()
        outcome = await discover_provider_sources(
            session,
            settings,
            provider.id,
            request_id="req-failure",
            client=client,
            now=datetime(2026, 8, 1, tzinfo=UTC),
        )
        await session.commit()
        run = await session.get(SourceDiscoveryRun, outcome.run_id)
        count = await session.scalar(select(func.count()).select_from(SourceCandidate))
        assert outcome.status is DiscoveryStatus.failed
        assert run is not None and run.failure_reason == "RuntimeError"
        assert count == 0

        retry_client = FakeClient(FakeResponse())
        retried = await discover_provider_sources(
            session,
            settings,
            provider.id,
            request_id="req-retry",
            client=retry_client,
            now=datetime(2026, 8, 1, tzinfo=UTC),
        )
        await session.commit()
        assert retried.run_id == outcome.run_id
        assert retried.status is DiscoveryStatus.completed
        assert retried.candidate_count == 1
        assert len(retry_client.responses.calls) == 1
    await engine.dispose()


async def test_discovery_keeps_unverified_domains_out_of_the_active_catalog(tmp_path: Path) -> None:
    settings, engine, factory = await _database(tmp_path)
    async with factory() as session:
        provider = Provider(
            name="Example",
            slug="example-unverified",
            official_domain="official.example",
        )
        session.add(provider)
        await session.commit()
        outcome = await discover_provider_sources(
            session,
            settings,
            provider.id,
            request_id="req-unverified",
            client=FakeClient(FakeResponse()),
            now=datetime(2026, 7, 20, tzinfo=UTC),
        )
        await session.commit()

        candidate = await session.scalar(select(SourceCandidate))
        assert outcome.status is DiscoveryStatus.completed
        assert candidate is not None
        assert candidate.status is CandidateStatus.discovered
        assert await session.scalar(select(PricingSource)) is None
    await engine.dispose()


def test_openai_discovery_schema_uses_plain_validated_url_string() -> None:
    schema = DiscoveryPayload.model_json_schema()
    source_schema = schema["$defs"]["DiscoveredSource"]["properties"]["url"]
    assert source_schema["type"] == "string"
    assert "format" not in source_schema


async def test_discovery_cost_limit_skips_openai(tmp_path: Path) -> None:
    settings, engine, factory = await _database(tmp_path)
    settings.discovery_monthly_cost_limit_micros = 0
    client = FakeClient(FakeResponse())
    async with factory() as session:
        provider = Provider(name="Example", slug="example")
        session.add(provider)
        await session.commit()
        outcome = await discover_provider_sources(
            session,
            settings,
            provider.id,
            request_id="req-budget",
            client=client,
            now=datetime(2026, 9, 1, tzinfo=UTC),
        )
        assert outcome.status is DiscoveryStatus.cost_limited
        assert client.responses.calls == []
    await engine.dispose()
