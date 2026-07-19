from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Protocol

from supabase import Client, create_client

from tamalife_backend.config import Settings


class Storage(Protocol):
    async def upload(self, path: str, data: bytes, content_type: str) -> str: ...

    async def delete(self, path: str) -> None: ...


class LocalStorage:
    def __init__(self, root: Path) -> None:
        self.root = root.resolve()

    def _resolve(self, path: str) -> Path:
        target = (self.root / path).resolve()
        if self.root not in target.parents:
            raise ValueError("storage path escapes configured root")
        return target

    async def upload(self, path: str, data: bytes, content_type: str) -> str:
        del content_type
        target = self._resolve(path)
        await asyncio.to_thread(target.parent.mkdir, parents=True, exist_ok=True)
        await asyncio.to_thread(target.write_bytes, data)
        return path

    async def delete(self, path: str) -> None:
        target = self._resolve(path)
        if target.exists():
            await asyncio.to_thread(target.unlink)


class SupabaseStorage:
    def __init__(self, url: str, service_key: str, bucket: str) -> None:
        self.client: Client = create_client(url, service_key)
        self.bucket = bucket

    async def upload(self, path: str, data: bytes, content_type: str) -> str:
        def _upload() -> None:
            self.client.storage.from_(self.bucket).upload(
                path=path,
                file=data,
                file_options={"content-type": content_type, "upsert": "false"},
            )

        await asyncio.to_thread(_upload)
        return path

    async def delete(self, path: str) -> None:
        await asyncio.to_thread(self.client.storage.from_(self.bucket).remove, [path])


def create_storage(settings: Settings) -> Storage:
    if settings.storage_backend == "supabase":
        assert settings.supabase_url and settings.supabase_service_key
        return SupabaseStorage(
            settings.supabase_url,
            settings.supabase_service_key,
            settings.supabase_storage_bucket,
        )
    return LocalStorage(settings.local_storage_root)
