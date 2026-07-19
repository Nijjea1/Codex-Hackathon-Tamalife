from celery import Celery

from tamalife_backend.config import get_settings

settings = get_settings()
celery_app = Celery(
    "tamalife",
    broker=settings.celery_broker_url or settings.redis_url,
    backend=settings.celery_result_backend or settings.redis_url,
    include=["tamalife_backend.tasks.reminders"],
)
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    beat_schedule={
        "scan-reminders-hourly": {
            "task": "tamalife.scan_reminders",
            "schedule": 3600.0,
        }
    },
)
