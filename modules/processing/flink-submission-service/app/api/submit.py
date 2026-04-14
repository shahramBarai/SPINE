"""
api/submit.py – POST /submit endpoint: validate bundle and submit to Flink.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.core.submission import submit_job
from app.core.validation import run_pre_submit_checks
from app.schemas import SubmitRequest, SubmitResult
from app.utils import get_logger

router = APIRouter(tags=["submission"])
logger = get_logger(__name__)


@router.post("/submit", response_model=SubmitResult)
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
            error=validation.error,
            job_id=None,
        )

    logger.info("All pre-submit checks passed. Submitting job to Flink …")

    # -- Flink submission ----------------------------------------------------
    result = submit_job(request)

    if result.success:
        logger.info("Job submitted successfully. job_id=%s", result.job_id)
    else:
        logger.error(
            "Flink submission failed: %s",
            result.error[:200],
        )

    return result