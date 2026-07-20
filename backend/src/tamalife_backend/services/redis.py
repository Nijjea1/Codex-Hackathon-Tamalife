from __future__ import annotations

import json
import time
from collections import defaultdict, deque
from typing import Any

from redis.asyncio import Redis
from redis.exceptions import RedisError

from tamalife_backend.config import Settings
from tamalife_backend.errors import ApiError


class Cache:
    def __init__(self, settings: Settings) -> None:
        self.enabled = settings.cache_enabled
        self.redis = (
            Redis.from_url(settings.redis_url, decode_responses=True) if self.enabled else None
        )

    async def get_json(self, key: str) -> dict[str, Any] | None:
        if self.redis is None:
            return None
        try:
            value = await self.redis.get(key)
            return json.loads(value) if value else None
        except (RedisError, json.JSONDecodeError, TypeError):
            return None

    async def set_json(self, key: str, value: dict[str, Any], ttl: int) -> None:
        if self.redis is not None:
            try:
                await self.redis.set(key, json.dumps(value, default=str), ex=ttl)
            except RedisError:
                return

    async def delete(self, key: str) -> None:
        if self.redis is not None:
            try:
                await self.redis.delete(key)
            except RedisError:
                return

    async def close(self) -> None:
        if self.redis is not None:
            try:
                await self.redis.aclose()
            except RedisError:
                return

    async def ping(self) -> bool:
        if self.redis is None:
            return False
        try:
            return bool(await self.redis.ping())
        except RedisError:
            return False


class ParseRateLimiter:
    def __init__(self, settings: Settings) -> None:
        self.limit = settings.parse_rate_limit_per_minute
        self.redis = (
            Redis.from_url(settings.redis_url, decode_responses=True)
            if settings.cache_enabled
            else None
        )
        self.local: dict[str, deque[float]] = defaultdict(deque)

    async def check(self, key: str) -> None:
        now = time.time()
        if self.redis is not None:
            window = int(now // 60)
            redis_key = f"rate:parse:{key}:{window}"
            count = await self.redis.incr(redis_key)
            if count == 1:
                await self.redis.expire(redis_key, 60)
            if count > self.limit:
                raise ApiError("rate_limit_exceeded", "Parse rate limit exceeded", 429)
            return
        bucket = self.local[key]
        while bucket and bucket[0] <= now - 60:
            bucket.popleft()
        if len(bucket) >= self.limit:
            raise ApiError("rate_limit_exceeded", "Parse rate limit exceeded", 429)
        bucket.append(now)

    async def close(self) -> None:
        if self.redis is not None:
            try:
                await self.redis.aclose()
            except RedisError:
                return
