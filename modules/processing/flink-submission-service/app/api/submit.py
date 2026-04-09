"""
api/submit.py – POST /submit endpoint: validate bundle and submit to Flink.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.core.submission import submit_job
from app.core.validation import (
    run_compileall_check,
    run_import_check,
    run_py_compile_check,
    validate_bundle_structure,
)
from app.schemas import SubmitRequest, SubmitResult, ValidationResult, BundleValidationError
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
    validation = _run_pre_submit_checks(request)

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


def _run_pre_submit_checks(request: SubmitRequest) -> ValidationResult:
    """
    Execute all pre-submit validation steps in order.

    Stops at the first failing step so that errors do not cascade.

    Parameters
    ----------
    request:
        The incoming submit request.

    Returns
    -------
    ValidationResult
        Aggregated result with per-step details.
    """
    all_steps = []

    # 1. Bundle path validation (raises BundleValidationError on failure)
    try:
        structure_steps = validate_bundle_structure(request)
        all_steps.extend(structure_steps)
    except BundleValidationError as exc:
        # Include whatever steps ran before the failure
        return ValidationResult(
            success=False,
            steps=all_steps,
            error=str(exc),
        )

    # 2. AST syntax check on entrypoint
    compile_step = run_py_compile_check(request.entrypoint)
    all_steps.append(compile_step)
    if not compile_step.success:
        return ValidationResult(
            success=False,
            steps=all_steps,
            error="Syntax check failed on entrypoint (AST parse)",
        )

    # 3. AST syntax check on pyfiles
    if request.pyfiles_path is not None:
        compileall_step = run_compileall_check(request.pyfiles_path)
        all_steps.append(compileall_step)
        if not compileall_step.success:
            return ValidationResult(
                success=False,
                steps=all_steps,
                error="Syntax check failed on pyfiles (AST parse)",
            )

    # 4. Import check
    import_step = run_import_check(request.entrypoint, request.pyfiles_path)
    all_steps.append(import_step)
    if not import_step.success:
        return ValidationResult(
            success=False,
            steps=all_steps,
            error="Import check failed on entrypoint",
        )

    return ValidationResult(success=True, steps=all_steps)
