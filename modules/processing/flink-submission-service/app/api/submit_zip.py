"""
api/submit_zip.py – POST /submit-zip endpoint: validate zip bundle and submit to Flink.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, File, UploadFile

from app.core.submission import submit_job
from app.core.validation import (
    ZipValidationError,
    cleanup_extraction,
    extract_zip_to_temp,
    validate_zip_file,
    run_pre_submit_checks,
)
from app.schemas import SubmitRequest, SubmitResult
from app.utils import get_logger

router = APIRouter(tags=["submission"])
logger = get_logger(__name__)


@router.post("/submit-zip", response_model=SubmitResult)
async def submit_zip(file: UploadFile = File(...)) -> SubmitResult:
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
