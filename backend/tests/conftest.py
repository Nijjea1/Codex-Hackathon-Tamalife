"""Test fixtures.

Because we use Clerk's official SDK (which verifies against live Clerk), tests
mock at the SDK boundary rather than minting real tokens:

  * `mock_clerk_state` patches `Clerk.authenticate_request` so we can simulate
    a signed-in or signed-out caller.
  * `client` is a plain TestClient over the app.

This keeps the suite fully offline and CI-safe while still exercising the real
route + dependency wiring.
"""

import os
from collections.abc import Iterator
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

# Ensure settings never depend on a real .env during tests.
os.environ.setdefault("CLERK_SECRET_KEY", "sk_test_dummy_for_tests")
os.environ.setdefault("ENVIRONMENT", "test")

from app.config import get_settings  # noqa: E402
from app.core.security import get_clerk_client  # noqa: E402
from app.main import create_app  # noqa: E402


@pytest.fixture(autouse=True)
def _clear_caches() -> Iterator[None]:
    get_settings.cache_clear()
    get_clerk_client.cache_clear()
    yield
    get_settings.cache_clear()
    get_clerk_client.cache_clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app())


@pytest.fixture
def mock_clerk_state() -> Iterator[MagicMock]:
    """Patch the Clerk client's authenticate_request; yields the mock so a test
    can set `.return_value.is_signed_in` / `.payload`."""
    fake_client = MagicMock()
    with patch("app.core.security.get_clerk_client", return_value=fake_client):
        yield fake_client.authenticate_request
