"""
Health check endpoint for the building service API.

Exposes:
    GET /api/health  -> returns the health status of the service and its dependencies
"""
from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel
from enum import StrEnum
from deps import get_fuseki_client, get_timescale_client

router = APIRouter(tags=["Health Check"])

# --- Initialize database clients ---
FusekiClient = get_fuseki_client()
TimescaleClient = get_timescale_client()

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
    fusekidb: ServiceStatus
    timescaledb: ServiceStatus

@router.get("/api/health", response_model=HealthResponse)
async def health() -> HealthResponse:

    timescaledb_connected, timescaledb_error = await TimescaleClient.ping()
    timescaledb = ServiceStatus(
        connected=timescaledb_connected,
        health_status=HealthStatus.HEALTHY if timescaledb_connected else HealthStatus.UNHEALTHY,
        error=timescaledb_error
    )

    fuseki_connected, fuseki_error = await FusekiClient.ping()
    fusekidb = ServiceStatus(
        connected=fuseki_connected,
        health_status=HealthStatus.HEALTHY if fuseki_connected else HealthStatus.UNHEALTHY,
        error=fuseki_error
    )

    status = HealthStatus.HEALTHY if timescaledb.connected and fusekidb.connected else HealthStatus.DEGRADED
    return HealthResponse(
        status=status,
        timescaledb=timescaledb,
        fusekidb=fusekidb
    )