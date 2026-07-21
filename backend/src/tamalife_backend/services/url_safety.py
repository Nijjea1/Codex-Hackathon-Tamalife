from __future__ import annotations

import asyncio
import ipaddress
import socket
from dataclasses import dataclass
from typing import Protocol
from urllib.parse import urlsplit, urlunsplit


class UnsafeURLError(ValueError):
    pass


class Resolver(Protocol):
    async def resolve(self, hostname: str, port: int) -> tuple[str, ...]: ...


class SystemResolver:
    async def resolve(self, hostname: str, port: int) -> tuple[str, ...]:
        loop = asyncio.get_running_loop()
        records = await loop.getaddrinfo(
            hostname, port, family=socket.AF_UNSPEC, type=socket.SOCK_STREAM
        )
        return tuple(dict.fromkeys(str(record[4][0]) for record in records))


@dataclass(frozen=True)
class ValidatedTarget:
    url: str
    scheme: str
    hostname: str
    port: int
    addresses: tuple[str, ...]


def _is_public(address: str) -> bool:
    ip = ipaddress.ip_address(address)
    return ip.is_global and not any(
        (
            ip.is_private,
            ip.is_loopback,
            ip.is_link_local,
            ip.is_multicast,
            ip.is_reserved,
            ip.is_unspecified,
        )
    )


async def validate_fetch_url(value: str, *, resolver: Resolver | None = None) -> ValidatedTarget:
    if not value or any(ord(character) < 32 for character in value) or "\\" in value:
        raise UnsafeURLError("URL contains prohibited characters")
    parsed = urlsplit(value)
    scheme = parsed.scheme.lower()
    if scheme not in {"http", "https"} or not parsed.hostname:
        raise UnsafeURLError("only absolute HTTP(S) URLs are permitted")
    if parsed.username is not None or parsed.password is not None:
        raise UnsafeURLError("URL user information is prohibited")
    if parsed.fragment:
        raise UnsafeURLError("URL fragments are prohibited")
    try:
        hostname = parsed.hostname.encode("idna").decode("ascii").rstrip(".").lower()
    except UnicodeError as exc:
        raise UnsafeURLError("invalid hostname") from exc
    if hostname in {"localhost", "localhost.localdomain"} or hostname.endswith(".local"):
        raise UnsafeURLError("local hostnames are prohibited")
    try:
        ipaddress.ip_address(hostname)
    except ValueError:
        pass
    else:
        raise UnsafeURLError("IP literal URLs are prohibited")
    try:
        port = parsed.port or (443 if scheme == "https" else 80)
    except ValueError as exc:
        raise UnsafeURLError("invalid port") from exc
    if port not in {80, 443}:
        raise UnsafeURLError("non-standard ports are prohibited")
    addresses = await (resolver or SystemResolver()).resolve(hostname, port)
    if not addresses or not all(_is_public(address) for address in addresses):
        raise UnsafeURLError("hostname does not resolve exclusively to public addresses")
    netloc = hostname
    if (scheme, port) not in {("http", 80), ("https", 443)}:
        netloc = f"{hostname}:{port}"
    normalized = urlunsplit((scheme, netloc, parsed.path or "/", parsed.query, ""))
    return ValidatedTarget(normalized, scheme, hostname, port, addresses)
