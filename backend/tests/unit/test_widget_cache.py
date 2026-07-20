from __future__ import annotations

from typing import Any, cast

from redis.exceptions import RedisError

from tamalife_backend.config import Settings
from tamalife_backend.services.redis import Cache


class BrokenRedis:
    async def get(self, key: str) -> str | None:
        raise RedisError(key)

    async def set(self, *args: object, **kwargs: object) -> None:
        raise RedisError

    async def delete(self, key: str) -> None:
        raise RedisError(key)

    async def aclose(self) -> None:
        raise RedisError


async def test_cache_operations_gracefully_fall_back_when_redis_is_down() -> None:
    cache = Cache(Settings(cache_enabled=False, clerk_auth_enabled=False))
    cache.redis = cast(Any, BrokenRedis())
    assert await cache.get_json("widget:user") is None
    await cache.set_json("widget:user", {"active_count": 1}, 60)
    await cache.delete("widget:user")
    await cache.close()
