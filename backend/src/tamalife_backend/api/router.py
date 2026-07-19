from fastapi import APIRouter

from tamalife_backend.api.me import router as me_router
from tamalife_backend.api.parsing import router as parsing_router
from tamalife_backend.api.preferences import router as preferences_router
from tamalife_backend.api.subscriptions import router as subscriptions_router
from tamalife_backend.api.widget import router as widget_router

api_router = APIRouter()
api_router.include_router(me_router)
api_router.include_router(subscriptions_router)
api_router.include_router(parsing_router)
api_router.include_router(preferences_router)
api_router.include_router(widget_router)
