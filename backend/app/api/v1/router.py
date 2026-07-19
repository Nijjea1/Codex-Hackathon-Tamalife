"""Aggregates every v1 route under a single router that main.py mounts."""

from fastapi import APIRouter

from app.api.v1.routes import health, me

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(me.router)
