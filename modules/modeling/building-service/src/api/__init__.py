"""
api/ - HTTP routes and endpoints.
"""

from fastapi import APIRouter

from .health import router as health_router
from .sersors import router as sensors_router

router = APIRouter()
router.include_router(health_router)
router.include_router(sensors_router)

__all__ = ["router"]