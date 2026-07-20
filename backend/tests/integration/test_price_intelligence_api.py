from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from uuid import UUID, uuid4

import httpx
import pytest

from tamalife_backend.config import Settings
from tamalife_backend.db.models import (
    BillingCycle,
    Deal,
    ItemType,
    MatchStatus,
    PlanAlternative,
    PlanPriceHistory,
    PriceChangeType,
    PricingSource,
    Provider,
    ProviderPlan,
    RecommendationStatus,
    ReviewStatus,
    SourceStatus,
    SourceType,
    Subscription,
    User,
    UserPlanMatch,
    UserRecommendation,
)
from tamalife_backend.main import create_app


async def seed_intelligence(app: object, owner_id: UUID, other_id: UUID) -> dict[str, object]:
    now = datetime.now(UTC)
    async with app.state.session_factory() as session:  # type: ignore[attr-defined]
        owner = User(id=owner_id, email="owner@example.com")
        other = User(id=other_id, email="other@example.com")
        session.add_all([owner, other])
        await session.flush()
        subscription = Subscription(
            user_id=owner.id,
            vendor_name="StreamFlix",
            display_name="StreamFlix",
            item_type=ItemType.subscription,
            amount=Decimal("19.99"),
            currency="CAD",
            billing_cycle=BillingCycle.monthly,
        )
        other_subscription = Subscription(
            user_id=other.id,
            vendor_name="Other",
            display_name="Other",
            item_type=ItemType.subscription,
            amount=Decimal("5.00"),
            currency="CAD",
            billing_cycle=BillingCycle.monthly,
        )
        session.add_all([subscription, other_subscription])
        provider = Provider(name="StreamFlix", slug="streamflix")
        other_provider = Provider(name="Other Provider", slug="other-provider")
        session.add_all([provider, other_provider])
        await session.flush()
        source = PricingSource(
            provider_id=provider.id,
            canonical_url="https://streamflix.example/pricing",
            normalized_url_hash=uuid4().hex,
            source_type=SourceType.pricing,
            country="CA",
            currency="CAD",
            status=SourceStatus.active,
            next_check_at=now,
            last_success_at=now,
            discovery_confidence=0.98,
        )
        other_source = PricingSource(
            provider_id=other_provider.id,
            canonical_url="https://other.example/pricing",
            normalized_url_hash=uuid4().hex,
            source_type=SourceType.pricing,
            country="CA",
            currency="CAD",
            status=SourceStatus.active,
            next_check_at=now,
        )
        session.add_all([source, other_source])
        await session.flush()
        plan = ProviderPlan(
            provider_id=provider.id,
            source_id=source.id,
            external_key="premium",
            name="Premium",
            normalized_name="premium",
            country="CA",
            currency="CAD",
            billing_cycle=BillingCycle.monthly,
            current_price=Decimal("19.99"),
            monthly_equivalent=Decimal("19.99"),
            confidence=0.95,
        )
        alternative_plan = ProviderPlan(
            provider_id=provider.id,
            source_id=source.id,
            external_key="basic",
            name="Basic",
            normalized_name="basic",
            country="CA",
            currency="CAD",
            billing_cycle=BillingCycle.monthly,
            current_price=Decimal("9.99"),
            monthly_equivalent=Decimal("9.99"),
            confidence=0.9,
        )
        invalid_plan = ProviderPlan(
            provider_id=other_provider.id,
            source_id=other_source.id,
            external_key="other",
            name="Other",
            normalized_name="other",
            country="CA",
            currency="CAD",
            billing_cycle=BillingCycle.monthly,
            current_price=Decimal("1.00"),
        )
        session.add_all([plan, alternative_plan, invalid_plan])
        await session.flush()
        match = UserPlanMatch(
            user_id=owner.id,
            subscription_id=subscription.id,
            provider_id=provider.id,
            provider_plan_id=plan.id,
            confidence=0.9,
            method="deterministic",
            status=MatchStatus.pending,
        )
        session.add(match)
        session.add_all(
            [
                PlanPriceHistory(
                    plan_id=plan.id,
                    price=Decimal("19.99"),
                    previous_price=Decimal("17.99"),
                    change_amount=Decimal("2.00"),
                    change_percentage=Decimal("11.117"),
                    change_type=PriceChangeType.increase,
                    confidence=0.94,
                    review_status=ReviewStatus.approved,
                    evidence_hash=uuid4().hex,
                ),
                PlanPriceHistory(
                    plan_id=plan.id,
                    price=Decimal("999.00"),
                    change_type=PriceChangeType.increase,
                    confidence=0.1,
                    review_status=ReviewStatus.pending,
                    evidence_hash=uuid4().hex,
                ),
            ]
        )
        approved_deal = Deal(
            provider_id=provider.id,
            plan_id=plan.id,
            source_id=source.id,
            fingerprint=uuid4().hex,
            title="Approved deal",
            promotional_price=Decimal("14.99"),
            currency="CAD",
            country="CA",
            source_url=source.canonical_url,
            confidence=0.91,
            review_status=ReviewStatus.approved,
        )
        pending_deal = Deal(
            provider_id=provider.id,
            plan_id=plan.id,
            source_id=source.id,
            fingerprint=uuid4().hex,
            title="Pending deal",
            country="CA",
            source_url=source.canonical_url,
            confidence=0.5,
            review_status=ReviewStatus.pending,
        )
        session.add_all([approved_deal, pending_deal])
        alternative = PlanAlternative(
            source_plan_id=plan.id,
            alternative_plan_id=alternative_plan.id,
            country="CA",
            feature_similarity=0.8,
            monthly_savings=Decimal("10.00"),
            annual_savings=Decimal("120.00"),
        )
        recommendation = UserRecommendation(
            user_id=owner.id,
            subscription_id=subscription.id,
            recommendation_type="switch_plan",
            target_plan_id=alternative_plan.id,
            deduplication_key="switch-basic",
            estimated_monthly_savings=Decimal("10.00"),
            estimated_annual_savings=Decimal("120.00"),
            explanation="Switch to Basic",
            confidence=0.88,
            generator_version="test-v1",
            status=RecommendationStatus.active,
            expires_at=now + timedelta(days=7),
        )
        other_recommendation = UserRecommendation(
            user_id=other.id,
            subscription_id=other_subscription.id,
            recommendation_type="cancel",
            deduplication_key="other-cancel",
            explanation="Other user's recommendation",
            confidence=0.8,
            generator_version="test-v1",
        )
        session.add_all([alternative, recommendation, other_recommendation])
        await session.commit()
        return {
            "subscription_id": subscription.id,
            "match_id": match.id,
            "plan_id": plan.id,
            "invalid_plan_id": invalid_plan.id,
            "recommendation_id": recommendation.id,
            "other_recommendation_id": other_recommendation.id,
        }


@pytest.mark.asyncio
async def test_price_intelligence_contract_ownership_and_review_filtering(tmp_path: Path) -> None:
    owner_id, other_id = uuid4(), uuid4()
    settings = Settings(
        environment="test",
        clerk_auth_enabled=False,
        default_user_id=owner_id,
        database_url=f"sqlite+aiosqlite:///{(tmp_path / 'intelligence.db').as_posix()}",
        storage_backend="local",
        local_storage_root=tmp_path / "storage",
        auto_create_schema=True,
    )
    app = create_app(settings)
    async with app.router.lifespan_context(app):
        ids = await seed_intelligence(app, owner_id, other_id)
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            subscription_id = ids["subscription_id"]
            intelligence = await client.get(f"/v1/subscriptions/{subscription_id}/intelligence")
            assert intelligence.status_code == 200
            match = intelligence.json()["match"]
            assert match["status"] == "pending"

            for suffix in ("intelligence", "price-history", "deals", "alternatives"):
                denied = await client.get(
                    f"/v1/subscriptions/{subscription_id}/{suffix}",
                    headers={"X-User-ID": str(other_id)},
                )
                assert denied.status_code == 404

            denied_confirmation = await client.post(
                f"/v1/subscriptions/{subscription_id}/match-confirmation",
                headers={"X-User-ID": str(other_id)},
                json={
                    "match_id": str(ids["match_id"]),
                    "status": "confirmed",
                    "provider_plan_id": str(ids["plan_id"]),
                    "expected_updated_at": match["updated_at"],
                },
            )
            assert denied_confirmation.status_code == 404

            stale = await client.post(
                f"/v1/subscriptions/{subscription_id}/match-confirmation",
                json={
                    "match_id": str(ids["match_id"]),
                    "status": "confirmed",
                    "provider_plan_id": str(ids["plan_id"]),
                    "expected_updated_at": "2000-01-01T00:00:00Z",
                },
            )
            assert stale.status_code == 409
            assert stale.json()["error"]["code"] == "stale_match"

            invalid_plan = await client.post(
                f"/v1/subscriptions/{subscription_id}/match-confirmation",
                json={
                    "match_id": str(ids["match_id"]),
                    "status": "confirmed",
                    "provider_plan_id": str(ids["invalid_plan_id"]),
                    "expected_updated_at": match["updated_at"],
                },
            )
            assert invalid_plan.status_code == 422
            assert invalid_plan.json()["error"]["code"] == "invalid_provider_plan"

            confirmed = await client.post(
                f"/v1/subscriptions/{subscription_id}/match-confirmation",
                json={
                    "match_id": str(ids["match_id"]),
                    "status": "confirmed",
                    "provider_plan_id": str(ids["plan_id"]),
                    "expected_updated_at": match["updated_at"],
                },
            )
            assert confirmed.status_code == 200
            assert confirmed.json()["match"]["status"] == "confirmed"

            history = await client.get(f"/v1/subscriptions/{subscription_id}/price-history")
            assert history.status_code == 200
            assert [item["price"] for item in history.json()["items"]] == ["19.99"]
            assert isinstance(history.json()["items"][0]["price"], str)
            assert history.json()["items"][0]["source"]["checked_at"] is not None
            assert history.json()["items"][0]["source"]["confidence"] == 0.94

            deal_response = await client.get(f"/v1/subscriptions/{subscription_id}/deals")
            assert [item["title"] for item in deal_response.json()["items"]] == ["Approved deal"]
            assert deal_response.json()["items"][0]["promotional_price"] == "14.99"

            alternative_response = await client.get(
                f"/v1/subscriptions/{subscription_id}/alternatives"
            )
            assert alternative_response.json()["items"][0]["monthly_savings"] == "10.00"

            summary = await client.get("/v1/price-intelligence/summary")
            assert summary.status_code == 200
            assert summary.json()["matched_count"] == 1
            assert summary.json()["price_change_count"] == 1
            assert summary.json()["active_deal_count"] == 1
            assert summary.json()["estimated_monthly_savings"] == "10.00"

            cross_user_feedback = await client.post(
                f"/v1/recommendations/{ids['other_recommendation_id']}/feedback",
                json={"feedback": "helpful", "status": "seen"},
            )
            assert cross_user_feedback.status_code == 404

            missing_reason = await client.post(
                f"/v1/recommendations/{ids['recommendation_id']}/feedback",
                json={"feedback": "not_helpful", "status": "dismissed"},
            )
            assert missing_reason.status_code == 422

            feedback = await client.post(
                f"/v1/recommendations/{ids['recommendation_id']}/feedback",
                json={
                    "feedback": "not_helpful",
                    "status": "dismissed",
                    "reason": "Not relevant",
                },
            )
            assert feedback.status_code == 200
            assert feedback.json()["feedback_reason"] == "Not relevant"
