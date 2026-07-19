from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta

import structlog
from sqlalchemy import select

from tamalife_backend.config import Settings, get_settings
from tamalife_backend.db.models import ParsedReceipt, ParseStatus
from tamalife_backend.db.session import create_engine, create_session_factory
from tamalife_backend.services.storage import create_storage
from tamalife_backend.tasks.celery_app import celery_app

logger = structlog.get_logger()


async def _cleanup_receipts(
    *, settings: Settings | None = None, now: datetime | None = None
) -> int:
    settings = settings or get_settings()
    now = now or datetime.now(UTC)
    cutoff = now - timedelta(days=settings.abandoned_receipt_retention_days)
    engine = create_engine(settings)
    factory = create_session_factory(engine)
    storage = create_storage(settings)
    deleted = 0
    try:
        async with factory() as session:
            receipts = list(
                (
                    await session.execute(
                        select(ParsedReceipt).where(
                            ParsedReceipt.status.in_(
                                [ParseStatus.pending, ParseStatus.failed, ParseStatus.needs_review]
                            ),
                            ParsedReceipt.created_at < cutoff,
                        )
                    )
                )
                .scalars()
                .all()
            )
            for receipt in receipts:
                try:
                    if receipt.storage_path:
                        await storage.delete(receipt.storage_path)
                    await session.delete(receipt)
                    deleted += 1
                except Exception as exc:
                    logger.warning(
                        "receipt_cleanup_failed",
                        receipt_id=str(receipt.id),
                        error_type=type(exc).__name__,
                    )
            await session.commit()
    finally:
        await engine.dispose()
    return deleted


@celery_app.task(name="tamalife.cleanup_receipts")  # type: ignore[untyped-decorator]
def cleanup_receipts() -> int:
    return asyncio.run(_cleanup_receipts())
