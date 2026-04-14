"""
main.py – FastAPI entrypoint for the Flink submission worker.

Exposes two endpoints:

  GET  /health   → liveness probe
  POST /submit   → validate bundle + submit to Flink Session Cluster

This service is an *internal* worker. It is not exposed to the UI layer.
"""

from __future__ import annotations

from fastapi import FastAPI

from app.api import router
from app.utils import config, configure_logging, get_logger

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

configure_logging()
logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

openapi_tags = [
    {
        "name": "Job Submission",
        "description": (
            "Endpoints to validate and submit PyFlink jobs to the Flink Session Cluster. "
        ),
    },
    {
        "name": "ops",
        "description": "Operational endpoints for service health and readiness.",
    },
]

app = FastAPI(
    title=config.SERVICE_NAME,
    version=config.SERVICE_VERSION,
    description=(
        "Internal Flink submission worker. "
        "Validates a prepared job bundle, then submits it to the running "
        "Flink Session Cluster via the Flink CLI."
    ),
    openapi_tags=openapi_tags,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Include API routes
app.include_router(router)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.get("/health", tags=["ops"])
def health() -> dict[str, str]:
    """Liveness probe. Returns ``{"status": "ok"}``."""
    return {"status": "ok"}
