"""
core/submission/executor.py – Execute Flink submission command.
"""

from __future__ import annotations

import subprocess

from app.utils import config
from app.schemas import SubmitRequest, SubmitResult
from .command import build_flink_command
from .parser import extract_job_id

def submit_job(
    request: SubmitRequest
) -> SubmitResult:
    """
    Submit the job bundle to the Flink Session Cluster via ``flink run --detached``.

    Detached mode makes ``flink run`` return as soon as the job is accepted
    by the cluster, rather than streaming logs until completion.

    Parameters
    ----------
    request:
        The submit request

    Returns
    -------
    SubmitResult
        Structured response containing the command, return code, captured
        output, parsed job_id, and the validation result.
    """
    cmd = build_flink_command(request)

    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=config.SUBMIT_TIMEOUT,
        )
    except subprocess.TimeoutExpired:
        return SubmitResult(
            success=False,
            error=(
                f"flink run timed out after {config.SUBMIT_TIMEOUT}s"
            ),
            job_id=None
        )
    except FileNotFoundError:
        return SubmitResult(
            success=False,
            error=(
                f"Flink binary not found: '{config.FLINK_BIN}'. "
                "Is Flink installed and on PATH inside the container?"
            ),
            job_id=None
        )

    success = proc.returncode == 0
    job_id = extract_job_id(proc.stdout, proc.stderr) if success else None

    return SubmitResult(
        success=success,
        error=None if success else proc.stderr.strip(),
        job_id=job_id,
    )
