"""
schemas/submit.py – Request/response models for the /submit endpoint.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Request
# ---------------------------------------------------------------------------


class SubmitRequest(BaseModel):
    """Payload sent by the caller (e.g. the NodeJS service) to /submit."""

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


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


class ValidationStep(BaseModel):
    """Result of a single pre-submit validation step."""

    step: str
    command: list[str]
    success: bool
    stdout: str = ""
    stderr: str = ""
    detail: str = ""


class ValidationResult(BaseModel):
    """Aggregate result of all pre-submit validation steps."""

    success: bool
    steps: list[ValidationStep]
    error: str | None = None


# ---------------------------------------------------------------------------
# Submit result
# ---------------------------------------------------------------------------


class SubmitResult(BaseModel):
    """Structured response returned by POST /submit."""

    success: bool
    command: list[str]
    returncode: int
    stdout: str
    stderr: str
    job_id: str | None = None
    validation: ValidationResult | None = None

# ---------------------------------------------------------------------------
# Exceptions errors for the Flink submission worker.
# ---------------------------------------------------------------------------
class BundleValidationError(Exception):
    """Raised when the job bundle fails structural validation."""

class PreSubmitCheckError(Exception):
    """Raised when Python pre-submit checks (AST syntax checks / import) fail."""

class FlinkSubmitError(Exception):
    """Raised when the Flink CLI command exits with a non-zero return code."""