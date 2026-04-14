"""
schemas/submit.py – Request and response models for submission endpoints.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Request
# ---------------------------------------------------------------------------


class SubmitRequest(BaseModel):
    """Payload sent by the caller to the JSON-based /submit endpoint."""

    entrypoint: str = Field(
        ...,
        description="Absolute path to the job bundle's main.py entrypoint.",
        examples=["/workspace/job_bundle/main.py"],
    )
    pyfiles_path: str | None = Field(
        default=None,
        description="Absolute path to the pyfiles directory to pass as --pyFiles.",
        examples=["/workspace/job_bundle/pyfiles"],
    )
    requirements_path: str | None = Field(
        default=None,
        description="Absolute path to requirements.txt to pass as --pyRequirements.",
        examples=["/workspace/job_bundle/requirements.txt"],
    )


class SubmitZipRequest(BaseModel):
    """Marker model for /submit-zip documentation.

    The actual endpoint accepts multipart/form-data with a file upload, so the
    request body itself is not represented as JSON.
    """

    pass


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

class ValidationResult(BaseModel):
    """Aggregate result of a validation step."""
    success: bool
    error: str | None = None


# ---------------------------------------------------------------------------
# Submit result
# ---------------------------------------------------------------------------


class SubmitResult(BaseModel):
    """Structured response returned by submission endpoints."""
    success: bool
    error: str | None = None
    job_id: str | None = None