"""
submitter.py – Build and execute the Flink CLI submission command.

This module is the only place that calls `flink run --detached`. It never touches
the filesystem or does validation itself; that is the job of validator.py.
"""

from __future__ import annotations

import subprocess

from app.models import SubmitRequest, SubmitResult, ValidationResult
from app.parser import extract_job_id
from app import settings


def build_flink_command(request: SubmitRequest) -> list[str]:
    """
    Construct the ``flink run --detached`` command tokens.

    Parameters
    ----------
    request:
        The validated submit request.

    Returns
    -------
    list[str]
        Command tokens suitable for ``subprocess.run()``.
    """
    cmd: list[str] = [
        settings.FLINK_BIN,
        "run",
        "--detached",
        "--jobmanager",
        settings.JOBMANAGER_ADDRESS,
        "--python",
        request.entrypoint,
    ]

    if request.pyfiles_path is not None:
        cmd += ["--pyFiles", request.pyfiles_path]

    if request.requirements_path is not None:
        cmd += ["--pyRequirements", request.requirements_path]

    return cmd


def submit_job(
    request: SubmitRequest,
    validation: ValidationResult,
) -> SubmitResult:
    """
    Submit the job bundle to the Flink Session Cluster via ``flink run --detached``.

    Pre-condition: ``validation.success`` must be ``True``. If validation
    failed we return an error result immediately without invoking Flink.

    Detached mode makes ``flink run`` return as soon as the job is accepted
    by the cluster, rather than streaming logs until completion.

    Parameters
    ----------
    request:
        The submit request.
    validation:
        The result of ``run_pre_submit_checks()``.

    Returns
    -------
    SubmitResult
        Structured response containing the command, return code, captured
        output, parsed job_id, and the validation result.
    """
    if not validation.success:
        return SubmitResult(
            success=False,
            command=[],
            returncode=-1,
            stdout="",
            stderr="Pre-submit validation failed",
            job_id=None,
            validation=validation,
        )

    cmd = build_flink_command(request)

    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=settings.SUBMIT_TIMEOUT,
        )
    except subprocess.TimeoutExpired:
        return SubmitResult(
            success=False,
            command=cmd,
            returncode=-1,
            stdout="",
            stderr=(
                f"flink run timed out after {settings.SUBMIT_TIMEOUT}s"
            ),
            job_id=None,
            validation=validation,
        )
    except FileNotFoundError:
        return SubmitResult(
            success=False,
            command=cmd,
            returncode=-1,
            stdout="",
            stderr=(
                f"Flink binary not found: '{settings.FLINK_BIN}'. "
                "Is Flink installed and on PATH inside the container?"
            ),
            job_id=None,
            validation=validation,
        )

    success = proc.returncode == 0
    job_id = extract_job_id(proc.stdout, proc.stderr) if success else None

    return SubmitResult(
        success=success,
        command=cmd,
        returncode=proc.returncode,
        stdout=proc.stdout.strip(),
        stderr=proc.stderr.strip(),
        job_id=job_id,
        validation=validation,
    )
