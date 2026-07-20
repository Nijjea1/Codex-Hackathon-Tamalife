import sentry_sdk
from celery import Celery
from celery.signals import worker_process_init

from tamalife_backend.config import get_settings
from tamalife_backend.logging import configure_logging

settings = get_settings()
celery_app = Celery(
    "tamalife",
    broker=settings.celery_broker_url or settings.redis_url,
    backend=settings.celery_result_backend or settings.redis_url,
    include=["tamalife_backend.tasks.reminders", "tamalife_backend.tasks.cleanup"],
)
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_track_started=True,
    task_soft_time_limit=settings.celery_task_soft_time_limit_seconds,
    task_time_limit=settings.celery_task_time_limit_seconds,
    result_expires=settings.celery_result_expires_seconds,
    worker_prefetch_multiplier=1,
    worker_cancel_long_running_tasks_on_connection_loss=True,
    worker_soft_shutdown_timeout=30.0,
    worker_enable_soft_shutdown_on_idle=True,
    broker_connection_retry_on_startup=True,
    broker_transport_options={
        "visibility_timeout": max(settings.celery_task_time_limit_seconds * 2, 300)
    },
    beat_schedule={
        "scan-reminders-hourly": {
            "task": "tamalife.scan_reminders",
            "schedule": float(settings.reminder_scan_interval_seconds),
        },
        "cleanup-abandoned-receipts-daily": {
            "task": "tamalife.cleanup_receipts",
            "schedule": 86400.0,
        },
    },
)


@worker_process_init.connect  # type: ignore[untyped-decorator]
def configure_worker(**_kwargs: object) -> None:
    configure_logging(settings.log_level)
    if settings.sentry_dsn:
        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            environment=settings.environment,
            traces_sample_rate=settings.sentry_traces_sample_rate,
            send_default_pii=False,
        )
