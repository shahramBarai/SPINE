"""
api/ – HTTP routes and endpoints.
"""

from fastapi import APIRouter

from .submit import router as submit_router
from .submit_zip import router as submit_zip_router

router = APIRouter()
router.include_router(submit_router)
router.include_router(submit_zip_router)

__all__ = ["router"]
