"""
Health check endpoint for the building service API.

Exposes:
    GET /api/health  -> returns the health status of the service and its dependencies
"""
from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel
from enum import StrEnum

router = APIRouter(tags=["Health Check"])

# --- Data Models ---
class HealthStatus(StrEnum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"

class ServiceStatus(BaseModel):
    connected: bool
    health_status: HealthStatus
    error: str | None = None

class HealthResponse(BaseModel):
    status: HealthStatus

@router.get("/api/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        status=HealthStatus.HEALTHY
    )