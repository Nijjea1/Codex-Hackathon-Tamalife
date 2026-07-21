from __future__ import annotations

import hashlib
import socket
import time
from dataclasses import dataclass
from urllib.parse import urljoin

import aiohttp
from aiohttp.abc import AbstractResolver, ResolveResult

from tamalife_backend.config import Settings
from tamalife_backend.services.url_safety import Resolver, ValidatedTarget, validate_fetch_url

ALLOWED_CONTENT_TYPES = {"text/html", "application/xhtml+xml", "application/json"}
REDIRECT_STATUSES = {301, 302, 303, 307, 308}


class FetchRejectedError(ValueError):
    pass


@dataclass(frozen=True)
class FetchResult:
    final_url: str
    status: int
    content_type: str | None
    body: bytes
    content_hash: str | None
    etag: str | None
    last_modified: str | None
    duration_ms: int
    not_modified: bool = False


class _PinnedResolver(AbstractResolver):
    def __init__(self, target: ValidatedTarget) -> None:
        self.target = target

    async def resolve(
        self,
        host: str,
        port: int = 0,
        family: socket.AddressFamily = socket.AF_INET,
    ) -> list[ResolveResult]:
        del family
        if host.rstrip(".").lower() != self.target.hostname or port != self.target.port:
            raise OSError("resolver target mismatch")
        return [
            ResolveResult(
                hostname=self.target.hostname,
                host=address,
                port=self.target.port,
                family=socket.AF_INET6 if ":" in address else socket.AF_INET,
                proto=0,
                flags=0,
            )
            for address in self.target.addresses
        ]

    async def close(self) -> None:
        return None


async def fetch_url(
    url: str,
    settings: Settings,
    *,
    etag: str | None = None,
    last_modified: str | None = None,
    resolver: Resolver | None = None,
) -> FetchResult:
    started = time.monotonic()
    current_url = url
    headers = {
        "User-Agent": settings.scraper_user_agent,
        "Accept": "text/html,application/xhtml+xml,application/json;q=0.8",
        "Accept-Encoding": "identity",
    }
    if etag:
        headers["If-None-Match"] = etag
    if last_modified:
        headers["If-Modified-Since"] = last_modified
    timeout = aiohttp.ClientTimeout(
        total=settings.scraper_total_timeout_seconds,
        connect=settings.scraper_connect_timeout_seconds,
        sock_read=settings.scraper_read_timeout_seconds,
    )

    for redirect_count in range(settings.scraper_max_redirects + 1):
        target = await validate_fetch_url(current_url, resolver=resolver)
        connector = aiohttp.TCPConnector(
            resolver=_PinnedResolver(target),
            use_dns_cache=False,
            ttl_dns_cache=0,
            limit=1,
            force_close=True,
        )
        async with aiohttp.ClientSession(
            connector=connector,
            timeout=timeout,
            trust_env=False,
            auto_decompress=False,
            cookie_jar=aiohttp.DummyCookieJar(),
        ) as client:
            async with client.get(target.url, headers=headers, allow_redirects=False) as response:
                if response.status in REDIRECT_STATUSES:
                    location = response.headers.get("Location")
                    if not location or redirect_count >= settings.scraper_max_redirects:
                        raise FetchRejectedError("redirect limit exceeded")
                    current_url = urljoin(target.url, location)
                    continue
                duration_ms = int((time.monotonic() - started) * 1000)
                if response.status == 304:
                    return FetchResult(
                        target.url,
                        response.status,
                        None,
                        b"",
                        None,
                        response.headers.get("ETag"),
                        response.headers.get("Last-Modified"),
                        duration_ms,
                        True,
                    )
                if response.status < 200 or response.status >= 300:
                    raise FetchRejectedError(f"upstream returned HTTP {response.status}")
                content_type = response.headers.get("Content-Type", "").split(";", 1)[0].lower()
                if content_type not in ALLOWED_CONTENT_TYPES:
                    raise FetchRejectedError("unsupported response content type")
                declared = response.content_length
                if declared is not None and declared > settings.scraper_max_response_bytes:
                    raise FetchRejectedError("response exceeds maximum size")
                body = bytearray()
                async for chunk in response.content.iter_chunked(64 * 1024):
                    body.extend(chunk)
                    if len(body) > settings.scraper_max_response_bytes:
                        raise FetchRejectedError("response exceeds maximum size")
                payload = bytes(body)
                return FetchResult(
                    target.url,
                    response.status,
                    content_type,
                    payload,
                    hashlib.sha256(payload).hexdigest(),
                    response.headers.get("ETag"),
                    response.headers.get("Last-Modified"),
                    duration_ms,
                )
    raise FetchRejectedError("redirect limit exceeded")
