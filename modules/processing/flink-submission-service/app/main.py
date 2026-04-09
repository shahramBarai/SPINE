"""
main.py – FastAPI entrypoint for the Flink submission worker.

Exposes two endpoints:

  GET  /health   → liveness probe
  POST /submit   → validate bundle + submit to Flink Session Cluster

This service is an *internal* worker. It is not exposed to the UI layer.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse

from app import settings
from app.exceptions import BundleValidationError
from app.models import SubmitRequest, SubmitResult
from app.submitter import submit_job
from app.validator import run_pre_submit_checks

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.DEBUG if settings.LOG_LEVEL == "DEV" else logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title=settings.SERVICE_NAME,
    version=settings.SERVICE_VERSION,
    description=(
        "Internal Flink submission worker. "
        "Validates a prepared job bundle, then submits it to the running "
        "Flink Session Cluster via the Flink CLI."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.get("/health", tags=["ops"])
def health() -> dict[str, str]:
    """Liveness probe. Returns ``{"status": "ok"}``."""
    return {"status": "ok"}


@app.post("/submit", response_model=SubmitResult, tags=["submission"])
def submit(request: SubmitRequest) -> SubmitResult:
    """
    Validate a job bundle and submit it to the Flink Session Cluster.

    **Workflow**

    1. Validate that all referenced bundle paths exist.
    2. Parse the entrypoint with ``ast.parse`` to catch syntax errors.
    3. Parse every Python file under the pyfiles directory with ``ast.parse``.
    4. Run an import check with ``PYTHONPATH`` set to ``pyfiles_path``.
    5. If all checks pass, run ``flink run --detached`` and capture output.
    6. Return a structured :class:`SubmitResult`.

    If any pre-submit check fails, Flink is **not** invoked and
    ``success`` will be ``false`` in the response.
    """
    logger.info(
        "Received submit request: entrypoint=%s",
        request.entrypoint,
    )

    # -- Pre-submit validation -----------------------------------------------
    logger.info("Running pre-submit checks …")
    validation = run_pre_submit_checks(request)

    if not validation.success:
        logger.warning("Pre-submit checks failed: %s", validation.error)
        # Return HTTP 200 with success=false so the caller can inspect the
        # structured validation output rather than catching an HTTP error.

        return SubmitResult(
            success=False,
            command=[],
            returncode=-1,
            stdout="",
            stderr="Pre-submit validation failed",
            job_id=None,
            validation=validation,
        )

    logger.info("All pre-submit checks passed. Submitting job to Flink …")

    # -- Flink submission ----------------------------------------------------
    result = submit_job(request, validation)

    if result.success:
        logger.info("Job submitted successfully. job_id=%s", result.job_id)
    else:
        logger.error(
            "Flink submission failed (rc=%d): %s",
            result.returncode,
            result.stderr[:200],
        )

    return result
