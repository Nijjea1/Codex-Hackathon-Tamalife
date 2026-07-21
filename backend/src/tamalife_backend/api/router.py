from fastapi import APIRouter

from tamalife_backend.api.admin_scraper import router as admin_scraper_router
from tamalife_backend.api.clerk_webhooks import router as clerk_webhooks_router
from tamalife_backend.api.dashboard import router as dashboard_router
from tamalife_backend.api.me import router as me_router
from tamalife_backend.api.operations import router as operations_router
from tamalife_backend.api.parsing import router as parsing_router
from tamalife_backend.api.preferences import router as preferences_router
from tamalife_backend.api.price_intelligence import router as price_intelligence_router
from tamalife_backend.api.subscriptions import router as subscriptions_router
from tamalife_backend.api.widget import router as widget_router

api_router = APIRouter()
api_router.include_router(admin_scraper_router)
api_router.include_router(clerk_webhooks_router)
api_router.include_router(me_router)
api_router.include_router(operations_router)
api_router.include_router(subscriptions_router)
api_router.include_router(dashboard_router)
api_router.include_router(parsing_router)
api_router.include_router(preferences_router)
api_router.include_router(price_intelligence_router)
api_router.include_router(widget_router)
