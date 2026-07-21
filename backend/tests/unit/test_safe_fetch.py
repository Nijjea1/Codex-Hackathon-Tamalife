from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any, ClassVar

import pytest

from tamalife_backend.config import Settings
from tamalife_backend.services.safe_fetch import FetchRejectedError, fetch_url
from tamalife_backend.services.url_safety import ValidatedTarget


class Content:
    def __init__(self, chunks: list[bytes]) -> None:
        self.chunks = chunks

    async def iter_chunked(self, _size: int) -> AsyncIterator[bytes]:
        for chunk in self.chunks:
            yield chunk


class Response:
    def __init__(
        self,
        status: int,
        *,
        headers: dict[str, str] | None = None,
        chunks: list[bytes] | None = None,
    ) -> None:
        self.status = status
        self.headers = headers or {}
        self.content = Content(chunks or [])
        self.content_length = sum(len(chunk) for chunk in chunks or [])

    async def __aenter__(self) -> Response:
        return self

    async def __aexit__(self, *_args: object) -> None:
        return None


class Session:
    responses: ClassVar[list[Response]] = []
    requested: ClassVar[list[str]] = []

    def __init__(self, **_kwargs: Any) -> None:
        pass

    async def __aenter__(self) -> Session:
        return self

    async def __aexit__(self, *_args: object) -> None:
        return None

    def get(self, url: str, **_kwargs: Any) -> Response:
        self.requested.append(url)
        return self.responses.pop(0)


async def _validator(url: str, **_kwargs: object) -> ValidatedTarget:
    hostname = url.split("/", 3)[2]
    return ValidatedTarget(url, "https", hostname, 443, ("93.184.216.34",))


async def test_fetch_revalidates_redirect_and_hashes_bounded_body(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    Session.requested = []
    Session.responses = [
        Response(302, headers={"Location": "https://cdn.example/pricing"}),
        Response(200, headers={"Content-Type": "text/html", "ETag": '"v1"'}, chunks=[b"ok"]),
    ]
    checked: list[str] = []

    async def validating(url: str, **kwargs: object) -> ValidatedTarget:
        checked.append(url)
        return await _validator(url, **kwargs)

    monkeypatch.setattr("tamalife_backend.services.safe_fetch.validate_fetch_url", validating)
    monkeypatch.setattr("tamalife_backend.services.safe_fetch.aiohttp.ClientSession", Session)
    result = await fetch_url(
        "https://example.com/pricing",
        Settings(clerk_auth_enabled=False, scraper_max_response_bytes=1024),
    )
    assert checked == ["https://example.com/pricing", "https://cdn.example/pricing"]
    assert result.body == b"ok"
    assert result.content_hash is not None and len(result.content_hash) == 64
    assert result.etag == '"v1"'


async def test_fetch_rejects_unsupported_or_oversized_content(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("tamalife_backend.services.safe_fetch.validate_fetch_url", _validator)
    monkeypatch.setattr("tamalife_backend.services.safe_fetch.aiohttp.ClientSession", Session)
    settings = Settings(clerk_auth_enabled=False, scraper_max_response_bytes=1024)
    Session.responses = [
        Response(200, headers={"Content-Type": "application/octet-stream"}, chunks=[b"x"])
    ]
    with pytest.raises(FetchRejectedError, match="content type"):
        await fetch_url("https://example.com/file", settings)
    Session.responses = [Response(200, headers={"Content-Type": "text/html"}, chunks=[b"x" * 1025])]
    with pytest.raises(FetchRejectedError, match="maximum size"):
        await fetch_url("https://example.com/large", settings)
