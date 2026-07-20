from __future__ import annotations

import json
from collections.abc import Awaitable, Callable
from typing import Any, cast

ASGIApp = Callable[
    [dict[str, Any], Callable[[], Awaitable[dict[str, Any]]], Callable[..., Awaitable[None]]],
    Awaitable[None],
]


class RequestTooLarge(Exception):
    pass


class SecurityMiddleware:
    def __init__(self, app: ASGIApp, *, max_body_bytes: int, hsts: bool = False) -> None:
        self.app = app
        self.max_body_bytes = max_body_bytes
        self.hsts = hsts

    async def __call__(
        self, scope: dict[str, Any], receive: Callable[..., Any], send: Callable[..., Any]
    ) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = {key.lower(): value for key, value in scope.get("headers", [])}
        content_length = headers.get(b"content-length")
        if content_length:
            try:
                if int(content_length) > self.max_body_bytes:
                    await self._too_large(send)
                    return
            except ValueError:
                await self._too_large(send)
                return

        received = 0

        async def limited_receive() -> dict[str, Any]:
            nonlocal received
            message = cast(dict[str, Any], await receive())
            if message.get("type") == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_body_bytes:
                    raise RequestTooLarge
            return message

        async def secure_send(message: dict[str, Any]) -> None:
            if message.get("type") == "http.response.start":
                response_headers = list(message.get("headers", []))
                response_headers.extend(
                    [
                        (b"x-content-type-options", b"nosniff"),
                        (b"x-frame-options", b"DENY"),
                        (b"referrer-policy", b"no-referrer"),
                        (b"permissions-policy", b"camera=(), microphone=(), geolocation=()"),
                        (b"cache-control", b"no-store"),
                    ]
                )
                if self.hsts:
                    response_headers.append(
                        (b"strict-transport-security", b"max-age=31536000; includeSubDomains")
                    )
                message["headers"] = response_headers
            await send(message)

        try:
            await self.app(scope, limited_receive, secure_send)
        except RequestTooLarge:
            await self._too_large(secure_send)

    @staticmethod
    async def _too_large(send: Callable[..., Any]) -> None:
        body = json.dumps(
            {"error": {"code": "request_too_large", "message": "Request body is too large"}}
        ).encode()
        await send(
            {
                "type": "http.response.start",
                "status": 413,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(body)).encode()),
                ],
            }
        )
        await send({"type": "http.response.body", "body": body})
