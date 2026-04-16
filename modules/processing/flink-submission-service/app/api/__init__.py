"""
api/ – HTTP routes and endpoints.
"""

from fastapi import APIRouter

from .submit import router as submit_router

router = APIRouter()
router.include_router(submit_router)

__all__ = ["router"]
