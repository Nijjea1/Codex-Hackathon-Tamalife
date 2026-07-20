from typing import Any

from fastapi import APIRouter

from tamalife_backend.api.dependencies import MetricsDep, UserDep

router = APIRouter(prefix="/operations", tags=["operations"])


@router.get("/metrics", response_model=dict)
async def metrics(metrics_store: MetricsDep, _user: UserDep) -> dict[str, Any]:
    return metrics_store.snapshot()
