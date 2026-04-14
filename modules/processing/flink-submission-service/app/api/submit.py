"""
api/submit.py – POST /submit endpoint: validate bundle and submit to Flink.
"""

from __future__ import annotations

import uuid
import shutil
from pathlib import Path

from fastapi import APIRouter, File, UploadFile

from app.core.submission import submit_job
from app.core.validation import (
    run_pre_submit_checks,
    cleanup_extraction,
    extract_zip_to_temp,
    validate_zip_file,
)
from app.schemas import SubmitRequest, SubmitResult
from app.utils import get_logger, config

router = APIRouter(tags=["Job Submission"])
logger = get_logger(__name__)


@router.post(
    "/submit-file",
    response_model=SubmitResult,
    summary="Submit a single Python entrypoint",
    description=(
        "Upload one Python file and submit it as `main.py` to the Flink Session Cluster. "
        "This endpoint is intended for simple jobs that do not require extra modules or "
        "a requirements file."
    ),
    responses={
        200: {
            "description": (
                "Submission result. `success=true` means the job was accepted by Flink; "
                "`success=false` means validation or submission failed and `error` describes why."
            )
        }
    },
)
async def submit_file(
    file: UploadFile = File(
        ...,
        description="Single Python source file (.py). It will be stored as main.py.",
    )
) -> SubmitResult:
    """
    Validate and submit a single Python entrypoint file to the Flink Session Cluster.

    **Request**
    Multipart form-data with a single file field named ``file``.

    **Rules**
    - The uploaded file must have a ``.py`` extension.
    - The uploaded content is stored as ``main.py`` in a temporary directory.
    - No requirements or additional pyfiles are used in this mode.
    """
    session_id = str(uuid.uuid4())
    extraction_path: Path | None = None

    try:
        logger.info("Received single-file submit request: filename=%s", file.filename)

        if not file.filename or not file.filename.endswith(".py"):
            return SubmitResult(
                success=False,
                error="Uploaded file must be a .py file",
                job_id=None,
            )

        file_bytes = await file.read()
        if not file_bytes:
            return SubmitResult(
                success=False,
                error="Uploaded file is empty",
                job_id=None,
            )

        extraction_path = Path(config.TEMP_EXTRACTION_DIR) / session_id
        extraction_path.mkdir(parents=True, exist_ok=True)

        entrypoint = extraction_path / "main.py"
        entrypoint.write_bytes(file_bytes)

        temp_request = SubmitRequest(
            entrypoint=str(entrypoint),
            pyfiles_path=None,
            requirements_path=None,
        )

        logger.info("Running pre-submit checks on uploaded main.py...")
        validation = run_pre_submit_checks(temp_request)
        if not validation.success:
            logger.warning("Pre-submit checks failed: %s", validation.error)
            return SubmitResult(
                success=False,
                error=validation.error or "Pre-submit validation failed",
                job_id=None,
            )

        logger.info("Pre-submit checks passed. Submitting job to Flink...")
        result = submit_job(temp_request)

        if result.success:
            logger.info("Job submitted successfully. job_id=%s", result.job_id)
        else:
            logger.error("Flink submission failed: %s", result.error[:200] if result.error else "unknown error")

        return result
    finally:
        if extraction_path and extraction_path.exists():
            try:
                shutil.rmtree(extraction_path)
                logger.info("Cleaned up temp folder: %s", extraction_path)
            except Exception as exc:
                logger.warning("Failed to clean up temp folder %s: %s", extraction_path, exc)


@router.post(
    "/submit-zip",
    response_model=SubmitResult,
    summary="Submit a zipped Python job bundle",
    description=(
        "Upload a zip archive containing `main.py` and optional `requirements.txt` and "
        "`modules/` files. The archive is validated, extracted to a temporary directory, "
        "and submitted to Flink using the same pre-submit checks as path-based submission."
    ),
    responses={
        200: {
            "description": (
                "Submission result. `success=true` means the job was accepted by Flink; "
                "`success=false` means validation, extraction, pre-submit checks, or submission failed."
            )
        }
    },
)
async def submit_zip(
    file: UploadFile = File(
        ...,
        description=(
            "Zip archive containing a strict root structure: main.py (required), "
            "requirements.txt (optional), and modules/ (optional, .py files only)."
        ),
    )
) -> SubmitResult:
    """
    Validate a job bundle from a zip file and submit it to the Flink Session Cluster.

    **Workflow**

    1. Validate the zip file (integrity, size, file types, main.py presence).
    2. Extract the zip to a temporary directory with a unique session ID.
    3. Validate that all required files exist and are syntactically correct.
    4. Parse the entrypoint with ``ast.parse`` to catch syntax errors.
    5. Parse every Python file under the extracted directory with ``ast.parse``.
    6. Run an import check with ``PYTHONPATH`` set to the extracted directory.
    7. If all checks pass, run ``flink run --detached`` and capture output.
    8. Clean up the temporary extraction directory.
    9. Return a structured :class:`SubmitResult`.

    If any validation check fails, Flink is **not** invoked and
    ``success`` will be ``false`` in the response. The temporary files are
    cleaned up regardless of success or failure.

    **Request**

    Multipart form with a single file field named 'file' (the zip archive).

    **Expected zip structure**

    Root level (strict):
      - main.py (required): Entry point for the Flink job
      - requirements.txt (optional): Python dependencies
      - modules/ folder (optional): can contain additional .py modules (no subdirectories)
    
    Only these files/folders are allowed. No other files at the root level.
    Maximum zip file size is 1 MB by default.
    """
    session_id = str(uuid.uuid4())
    extraction_path = None

    try:
        logger.info("Received zip submission request: filename=%s", file.filename)

        # Read the file bytes
        file_bytes = await file.read()

        # -- Zip validation --------------------------------------------------
        logger.info("Validating zip file...")
        validation_result = validate_zip_file(file_bytes)
        if not validation_result["is_valid"]:
            error_msg = validation_result["error"] or "Zip validation failed"
            logger.warning("Zip validation failed: %s", error_msg)
            return SubmitResult(
                success=False,
                error=error_msg,
                job_id=None
            )

        # -- Zip extraction --------------------------------------------------
        logger.info("Extracting zip file to temporary directory...")
        extraction_path = extract_zip_to_temp(file_bytes, session_id)
        if not extraction_path:
            logger.error("Failed to extract zip file.")
            return SubmitResult(
                success=False,
                error="Zip extraction failed",
                job_id=None
            )

        # The extracted zip is treated like a bundle with:
        # - entrypoint: {extraction_path}/main.py
        # - pyfiles_path: {extraction_path} (contains any .py files and/or modules/ folder)
        # - requirements_path: {extraction_path}/requirements.txt (if exists)
        has_requirements = validation_result["has_requirements_txt"]
        has_modules = validation_result["has_modules_folder"]
        
        temp_request = SubmitRequest(
            entrypoint=f"{extraction_path}/main.py",
            pyfiles_path=extraction_path,  # Includes modules/ folder and root .py files
            requirements_path=f"{extraction_path}/requirements.txt" if has_requirements else None,
        )
        
        logger.info(
            "Extracted bundle: entrypoint=main.py, modules=%s, requirements=%s",
            has_modules,
            has_requirements,
        )

        # -- Pre-submit validation ----------------------------------------------------
        logger.info("Running pre-submit checks on extracted bundle...")
        validation = run_pre_submit_checks(temp_request)
        if not validation.success:
            logger.warning("Pre-submit checks failed: %s", validation.error)
            return SubmitResult(
                success=False,
                error=validation.error or "Pre-submit validation failed",
                job_id=None
            )

        logger.info("All pre-submit checks passed. Submitting job to Flink...")
        result = submit_job(temp_request)

        if result.success:
            logger.info("Job submitted successfully. job_id=%s", result.job_id)
        else:
            logger.error(
                "Flink submission failed: %s",
                result.error[:200],
            )

        return result
    finally:
        if extraction_path:
            logger.info("Cleaning up temporary extraction directory...")
            cleanup_extraction(extraction_path)
