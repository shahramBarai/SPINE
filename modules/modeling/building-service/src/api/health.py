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
def health() -> HealthResponse:

    # TODO: Implement actual health check logic for TimescaleDB and FusekiDB
	timescaledb = ServiceStatus(
        connected=True,  # Placeholder for actual health check logic
        health_status=HealthStatus.HEALTHY,  # Placeholder for actual health status
        error=None  # Placeholder for actual error message if any
    )
	
    # TODO: Implement actual health check logic for FusekiDB
	fusekidb = ServiceStatus(
        connected=True,  # Placeholder for actual health check logic
        health_status=HealthStatus.HEALTHY,  # Placeholder for actual health status
        error=None  # Placeholder for actual error message if any
    )

	status = HealthStatus.HEALTHY if timescaledb.connected and fusekidb.connected else HealthStatus.DEGRADED
	return HealthResponse(
		status=status,
		timescaledb=timescaledb,
		fusekidb=fusekidb
	)