"""Auth route + verification tests.

Covers the four cases that matter: no token, signed-out, signed-in, and the
dependency-override path (how other route tests will inject a fake user later).
"""

from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from app.core.security import get_current_user
from app.main import create_app
from app.schemas.auth import CurrentUser


def test_me_requires_auth_when_no_token(client: TestClient) -> None:
    # No Authorization header -> Clerk reports signed-out -> 401 envelope.
    # (The real SDK runs here; with a dummy key it will not report signed-in.)
    resp = client.get("/v1/me")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "unauthorized"


def test_me_signed_out(client: TestClient, mock_clerk_state: MagicMock) -> None:
    mock_clerk_state.return_value = MagicMock(is_signed_in=False, reason="no_session_token")
    resp = client.get("/v1/me", headers={"Authorization": "Bearer bad"})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "unauthorized"


def test_me_signed_in(client: TestClient, mock_clerk_state: MagicMock) -> None:
    mock_clerk_state.return_value = MagicMock(
        is_signed_in=True,
        payload={"sub": "user_123", "sid": "sess_abc", "azp": "tamalife"},
    )
    resp = client.get("/v1/me", headers={"Authorization": "Bearer good"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["clerk_user_id"] == "user_123"
    assert body["session_id"] == "sess_abc"
    assert body["claims"]["azp"] == "tamalife"


def test_me_signed_in_missing_sub(client: TestClient, mock_clerk_state: MagicMock) -> None:
    mock_clerk_state.return_value = MagicMock(is_signed_in=True, payload={"sid": "sess_abc"})
    resp = client.get("/v1/me", headers={"Authorization": "Bearer weird"})
    assert resp.status_code == 401


def test_me_with_dependency_override() -> None:
    # Pattern future route tests will use: bypass Clerk entirely by injecting
    # a known CurrentUser.
    app = create_app()
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        clerk_user_id="user_override", claims={"sub": "user_override"}
    )
    with TestClient(app) as c:
        resp = c.get("/v1/me")
    assert resp.status_code == 200
    assert resp.json()["clerk_user_id"] == "user_override"
