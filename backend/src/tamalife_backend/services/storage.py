from __future__ import annotations

import asyncio
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from supabase import Client, create_client
from tamalife_backend.config import Settings


class Storage(Protocol):
    async def upload(self, path: str, data: bytes, content_type: str) -> str: ...

    async def delete(self, path: str) -> None: ...

    async def download(self, path: str) -> bytes: ...

    async def create_signed_url(self, path: str, expires_in: int) -> str | None: ...

    async def healthcheck(self) -> None: ...


@dataclass(frozen=True)
class ValidatedUpload:
    content_type: str
    extension: str


def validate_receipt_upload(data: bytes, content_type: str) -> ValidatedUpload:
    signatures: dict[str, tuple[Callable[[bytes], bool], str]] = {
        "image/jpeg": (lambda value: value.startswith(b"\xff\xd8\xff"), ".jpg"),
        "image/png": (lambda value: value.startswith(b"\x89PNG\r\n\x1a\n"), ".png"),
        "image/webp": (
            lambda value: len(value) >= 12 and value.startswith(b"RIFF") and value[8:12] == b"WEBP",
            ".webp",
        ),
        "application/pdf": (lambda value: value.startswith(b"%PDF-"), ".pdf"),
    }
    validator = signatures.get(content_type)
    if validator is None or not validator[0](data):
        raise ValueError("File contents do not match the declared receipt type")
    return ValidatedUpload(content_type=content_type, extension=validator[1])


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

        def _write_exclusive() -> None:
            with target.open("xb") as output:
                output.write(data)

        await asyncio.to_thread(_write_exclusive)
        return path

    async def delete(self, path: str) -> None:
        target = self._resolve(path)
        if target.exists():
            await asyncio.to_thread(target.unlink)

    async def download(self, path: str) -> bytes:
        return await asyncio.to_thread(self._resolve(path).read_bytes)

    async def create_signed_url(self, path: str, expires_in: int) -> str | None:
        del path, expires_in
        return None

    async def healthcheck(self) -> None:
        await asyncio.to_thread(self.root.mkdir, parents=True, exist_ok=True)


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

    async def download(self, path: str) -> bytes:
        return await asyncio.to_thread(self.client.storage.from_(self.bucket).download, path)

    async def create_signed_url(self, path: str, expires_in: int) -> str | None:
        response = await asyncio.to_thread(
            self.client.storage.from_(self.bucket).create_signed_url,
            path,
            expires_in,
        )
        value = response.get("signedURL") or response.get("signedUrl")
        return str(value) if value else None

    async def healthcheck(self) -> None:
        await asyncio.to_thread(self.client.storage.get_bucket, self.bucket)


def create_storage(settings: Settings) -> Storage:
    if settings.storage_backend == "supabase":
        assert settings.supabase_url and settings.supabase_service_key
        return SupabaseStorage(
            settings.supabase_url,
            settings.supabase_service_key,
            settings.supabase_storage_bucket,
        )
    return LocalStorage(settings.local_storage_root)
