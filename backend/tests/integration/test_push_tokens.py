from __future__ import annotations

import httpx

OTHER_USER = "11111111-1111-1111-1111-111111111111"


async def test_register_is_idempotent_and_refreshes_last_seen(client: httpx.AsyncClient) -> None:
    first = await client.post(
        "/v1/notifications/push-tokens",
        json={"token": "device-a", "platform": "android"},
    )
    assert first.status_code == 201, first.text
    assert first.json()["platform"] == "android"

    # Re-registering the same device updates the row in place rather than
    # creating a duplicate or failing on the unique constraint.
    second = await client.post(
        "/v1/notifications/push-tokens",
        json={"token": "device-a", "platform": "ios"},
    )
    assert second.status_code == 201, second.text
    assert second.json()["id"] == first.json()["id"]
    assert second.json()["platform"] == "ios"
    assert second.json()["last_seen_at"] >= first.json()["last_seen_at"]


async def test_register_reassigns_token_to_the_new_owner(client: httpx.AsyncClient) -> None:
    mine = await client.post(
        "/v1/notifications/push-tokens",
        json={"token": "shared-handset", "platform": "ios"},
    )
    assert mine.status_code == 201

    # The same handset signing in as somebody else takes the token over, so
    # the previous owner stops receiving that device's notifications.
    theirs = await client.post(
        "/v1/notifications/push-tokens",
        json={"token": "shared-handset", "platform": "ios"},
        headers={"X-User-ID": OTHER_USER},
    )
    assert theirs.status_code == 201, theirs.text
    assert theirs.json()["id"] == mine.json()["id"]

    # The original owner can no longer revoke it: it is not theirs any more.
    orphaned = await client.request(
        "DELETE", "/v1/notifications/push-tokens", json={"token": "shared-handset"}
    )
    assert orphaned.status_code == 404


async def test_unregister_is_idempotent_and_ownership_scoped(client: httpx.AsyncClient) -> None:
    await client.post(
        "/v1/notifications/push-tokens",
        json={"token": "device-b", "platform": "android"},
    )

    other = await client.request(
        "DELETE",
        "/v1/notifications/push-tokens",
        json={"token": "device-b"},
        headers={"X-User-ID": OTHER_USER},
    )
    assert other.status_code == 404

    removed = await client.request(
        "DELETE", "/v1/notifications/push-tokens", json={"token": "device-b"}
    )
    assert removed.status_code == 204

    # Deleting again is a no-op rather than an error, so a retried request
    # from a flaky client does not surface a failure.
    again = await client.request(
        "DELETE", "/v1/notifications/push-tokens", json={"token": "device-b"}
    )
    assert again.status_code == 204


async def test_register_rejects_unknown_platform(client: httpx.AsyncClient) -> None:
    response = await client.post(
        "/v1/notifications/push-tokens",
        json={"token": "device-c", "platform": "windows"},
    )
    assert response.status_code == 422
