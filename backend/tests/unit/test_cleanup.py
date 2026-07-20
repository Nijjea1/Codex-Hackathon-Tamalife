from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy import select

from tamalife_backend.config import Settings
from tamalife_backend.db.models import ParsedReceipt, ParseStatus, RawInputType, User
from tamalife_backend.db.session import create_engine, create_schema, create_session_factory
from tamalife_backend.services.storage import LocalStorage
from tamalife_backend.tasks.cleanup import _cleanup_receipts


async def test_cleanup_removes_abandoned_database_and_storage_records(tmp_path: Path) -> None:
    now = datetime(2026, 7, 18, tzinfo=UTC)
    settings = Settings(
        environment="test",
        database_url=f"sqlite+aiosqlite:///{(tmp_path / 'cleanup.db').as_posix()}",
        local_storage_root=tmp_path / "storage",
        auto_create_schema=False,
        clerk_auth_enabled=False,
        abandoned_receipt_retention_days=7,
    )
    engine = create_engine(settings)
    await create_schema(engine)
    factory = create_session_factory(engine)
    storage = LocalStorage(settings.local_storage_root)
    async with factory() as session:
        user = User(email="deleted@example.com")
        session.add(user)
        await session.flush()
        receipt = ParsedReceipt(
            user_id=user.id,
            raw_input_type=RawInputType.image,
            status=ParseStatus.failed,
            prompt_version="receipt-v1",
            storage_path=f"{user.id}/old/original.png",
            created_at=now - timedelta(days=8),
        )
        session.add(receipt)
        await storage.upload(receipt.storage_path, b"old", "image/png")
        await session.commit()
        receipt_id = receipt.id
    await engine.dispose()

    assert await _cleanup_receipts(settings=settings, now=now) == 1
    assert not (settings.local_storage_root / f"{user.id}/old/original.png").exists()
    engine = create_engine(settings)
    factory = create_session_factory(engine)
    async with factory() as session:
        assert (
            await session.scalar(select(ParsedReceipt).where(ParsedReceipt.id == receipt_id))
            is None
        )
    await engine.dispose()
