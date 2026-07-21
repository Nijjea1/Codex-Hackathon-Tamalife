from __future__ import annotations

import pytest

from tamalife_backend.services.url_safety import UnsafeURLError, validate_fetch_url


class Resolver:
    def __init__(self, *addresses: str) -> None:
        self.addresses = addresses

    async def resolve(self, hostname: str, port: int) -> tuple[str, ...]:
        del hostname, port
        return self.addresses


async def test_accepts_and_normalizes_public_https_url() -> None:
    target = await validate_fetch_url(
        "HTTPS://Example.COM/pricing?region=ca", resolver=Resolver("93.184.216.34")
    )
    assert target.url == "https://example.com/pricing?region=ca"
    assert target.port == 443
    assert target.addresses == ("93.184.216.34",)


@pytest.mark.parametrize(
    "url",
    [
        "file:///etc/passwd",
        "https://localhost/prices",
        "https://service.local/prices",
        "https://user:pass@example.com/prices",
        "https://example.com:8443/prices",
        "https://127.0.0.1/prices",
        "https://[::1]/prices",
        "https://example.com/prices#fragment",
        "https://example.com\\@127.0.0.1/prices",
        "https://example.com/\nprices",
    ],
)
async def test_rejects_unsafe_url_shapes(url: str) -> None:
    with pytest.raises(UnsafeURLError):
        await validate_fetch_url(url, resolver=Resolver("93.184.216.34"))


@pytest.mark.parametrize(
    "addresses",
    [
        ("127.0.0.1",),
        ("10.0.0.1",),
        ("169.254.169.254",),
        ("::1",),
        ("fc00::1",),
        ("93.184.216.34", "10.0.0.1"),
        (),
    ],
)
async def test_rejects_any_non_public_dns_answer(addresses: tuple[str, ...]) -> None:
    with pytest.raises(UnsafeURLError):
        await validate_fetch_url("https://example.com/", resolver=Resolver(*addresses))
