from pathlib import Path

import pytest

from tamalife_backend.services.storage import LocalStorage, validate_receipt_upload


@pytest.mark.parametrize(
    ("content_type", "data", "extension"),
    [
        ("image/jpeg", b"\xff\xd8\xffrest", ".jpg"),
        ("image/png", b"\x89PNG\r\n\x1a\nrest", ".png"),
        ("image/webp", b"RIFF0000WEBPrest", ".webp"),
        ("application/pdf", b"%PDF-1.7 rest", ".pdf"),
    ],
)
def test_validates_file_signatures(content_type: str, data: bytes, extension: str) -> None:
    assert validate_receipt_upload(data, content_type).extension == extension


def test_rejects_mismatched_file_signature() -> None:
    with pytest.raises(ValueError):
        validate_receipt_upload(b"not an image", "image/png")


async def test_local_storage_never_overwrites(tmp_path: Path) -> None:
    storage = LocalStorage(tmp_path)
    await storage.upload("user/parse/original.png", b"first", "image/png")
    with pytest.raises(FileExistsError):
        await storage.upload("user/parse/original.png", b"second", "image/png")
    assert await storage.download("user/parse/original.png") == b"first"
