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

app = FastAPI(
    title=config.SERVICE_NAME,
    version=config.SERVICE_VERSION,
    description=(
        "Internal Flink submission worker. "
        "Validates a prepared job bundle, then submits it to the running "
        "Flink Session Cluster via the Flink CLI."
    ),
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
