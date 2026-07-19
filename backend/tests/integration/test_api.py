from __future__ import annotations

import httpx


async def create_item(client: httpx.AsyncClient, payload: dict[str, object]) -> dict[str, object]:
    response = await client.post("/v1/subscriptions", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


async def test_health_and_readiness(client: httpx.AsyncClient) -> None:
    health = await client.get("/health")
    ready = await client.get("/ready")
    assert health.status_code == 200
    assert health.json()["status"] == "ok"
    assert ready.json() == {
        "status": "ready",
        "database": "ok",
        "cache": "disabled",
        "storage": "ok",
    }
    assert health.headers["x-request-id"]
    assert health.headers["x-content-type-options"] == "nosniff"
    assert health.headers["x-frame-options"] == "DENY"


async def test_subscription_crud_and_resolution(
    client: httpx.AsyncClient, subscription_payload: dict[str, object]
) -> None:
    item = await create_item(client, subscription_payload)
    assert item["currency"] == "USD"
    assert item["annual_cost"] == "239.88"
    assert item["attention_state"] in {"none", "upcoming", "urgent", "overdue"}

    listing = await client.get("/v1/subscriptions")
    assert listing.status_code == 200
    assert len(listing.json()["items"]) == 1

    resolved = await client.patch(
        f"/v1/subscriptions/{item['id']}/resolve",
        json={"action": "keep", "idempotency_key": "keep-once"},
    )
    assert resolved.status_code == 200, resolved.text
    assert resolved.json()["mood"] == "resolved"

    duplicate = await client.patch(
        f"/v1/subscriptions/{item['id']}/resolve",
        json={"action": "keep", "idempotency_key": "keep-once"},
    )
    assert duplicate.status_code == 200

    archived = await client.delete(f"/v1/subscriptions/{item['id']}")
    assert archived.status_code == 204
    assert (await client.get("/v1/subscriptions")).json()["items"] == []


async def test_dashboard_summary_is_user_scoped(
    client: httpx.AsyncClient, subscription_payload: dict[str, object]
) -> None:
    await create_item(client, subscription_payload)
    other = dict(subscription_payload)
    other["display_name"] = "Another user's item"
    response = await client.post(
        "/v1/subscriptions",
        json=other,
        headers={"X-User-ID": "00000000-0000-0000-0000-000000000002"},
    )
    assert response.status_code == 201

    summary = await client.get("/v1/dashboard/summary")
    assert summary.status_code == 200
    assert summary.json()["active_count"] == 1
    assert summary.json()["monthly_cost"] == "19.99"


async def test_me_returns_local_identity(client: httpx.AsyncClient) -> None:
    response = await client.get("/v1/me")
    assert response.status_code == 200
    assert response.json()["user_id"] == "00000000-0000-0000-0000-000000000001"


async def test_ownership_scope(
    client: httpx.AsyncClient, subscription_payload: dict[str, object]
) -> None:
    item = await create_item(client, subscription_payload)
    response = await client.get(
        f"/v1/subscriptions/{item['id']}",
        headers={"X-User-ID": "00000000-0000-0000-0000-000000000002"},
    )
    assert response.status_code == 404


async def test_preferences(client: httpx.AsyncClient) -> None:
    defaults = await client.get("/v1/notification-preferences")
    assert defaults.json()["reminder_days_before"] == [14, 7, 1]
    changed = await client.patch(
        "/v1/notification-preferences",
        json={"reminder_days_before": [1, 30, 7, 7], "email_enabled": True},
    )
    assert changed.json()["reminder_days_before"] == [30, 7, 1]
    assert changed.json()["email_enabled"] is True


async def test_parse_and_confirm(client: httpx.AsyncClient) -> None:
    receipt = "StreamFlix\nYour monthly plan renews 2026-08-12. Previous $17.99, now $19.99."
    parsed = await client.post("/v1/parse", data={"text": receipt})
    assert parsed.status_code == 200, parsed.text
    body = parsed.json()
    assert body["status"] == "completed"
    assert body["extracted"]["amount"] == "19.99"

    confirmed = await client.post(
        f"/v1/parse/{body['id']}/confirm",
        json={
            "extracted": body["extracted"],
            "creature_name": "Nova",
            "creature_species": "gem",
        },
    )
    assert confirmed.status_code == 201, confirmed.text
    assert confirmed.json()["subscription"]["vendor_name"] == "StreamFlix"


async def test_receipt_file_validation_access_and_cleanup(client: httpx.AsyncClient) -> None:
    invalid = await client.post(
        "/v1/parse",
        files={"image": ("receipt.png", b"not-png", "image/png")},
    )
    assert invalid.status_code == 415
    assert invalid.json()["error"]["code"] == "invalid_file_contents"

    image = b"\x89PNG\r\n\x1a\nmock-image-content"
    parsed = await client.post(
        "/v1/parse",
        files={"image": ("receipt.png", image, "image/png")},
    )
    assert parsed.status_code == 200
    parse_id = parsed.json()["id"]
    access = await client.get(f"/v1/parse/{parse_id}/file")
    assert access.status_code == 200
    assert access.json()["url"] == f"/v1/parse/{parse_id}/content"
    content = await client.get(access.json()["url"])
    assert content.status_code == 200
    assert content.content == image

    deleted = await client.delete(f"/v1/parse/{parse_id}")
    assert deleted.status_code == 204
    assert (await client.get(f"/v1/parse/{parse_id}")).status_code == 404


async def test_widget_token_and_summary(
    client: httpx.AsyncClient, subscription_payload: dict[str, object]
) -> None:
    await create_item(client, subscription_payload)
    minted = await client.post("/v1/widget/token")
    assert minted.status_code == 201
    token = minted.json()["token"]
    unauthorized = await client.get("/v1/widget/summary")
    assert unauthorized.status_code == 401
    summary = await client.get("/v1/widget/summary", headers={"Authorization": f"Bearer {token}"})
    assert summary.status_code == 200, summary.text
    assert summary.json()["active_count"] == 1


async def test_consistent_validation_error(client: httpx.AsyncClient) -> None:
    response = await client.post("/v1/subscriptions", json={})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


async def test_request_body_limit(client: httpx.AsyncClient) -> None:
    response = await client.post(
        "/v1/parse",
        content=b"x" * 2048,
        headers={"Content-Type": "application/octet-stream"},
    )
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "request_too_large"


async def test_account_export_and_deletion(
    client: httpx.AsyncClient, subscription_payload: dict[str, object]
) -> None:
    await create_item(client, subscription_payload)
    exported = await client.get("/v1/me/export")
    assert exported.status_code == 200
    assert exported.json()["subscriptions"][0]["vendor_name"] == "StreamFlix"

    deleted = await client.delete("/v1/me")
    assert deleted.status_code == 204
    disabled = await client.get("/v1/me")
    assert disabled.status_code == 403
    assert disabled.json()["error"]["code"] == "account_disabled"
