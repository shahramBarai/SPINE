"""
parser.py – Extract the Flink job_id from CLI stdout / stderr output.

Flink CLI output patterns vary slightly across versions. This module uses
regex to cover a reasonable set of observed patterns from Flink 1.x / 2.x.
"""

from __future__ import annotations

import re

# ---------------------------------------------------------------------------
# Regex patterns (ordered from most specific to most general)
# ---------------------------------------------------------------------------

_JOB_ID_PATTERNS: list[re.Pattern[str]] = [
    # "Job has been submitted with JobID abc123..."
    re.compile(r"Job has been submitted with JobID\s+([0-9a-f]{32})", re.IGNORECASE),
    # "JobID: abc123..."  (some Flink versions)
    re.compile(r"JobID[:\s]+([0-9a-f]{32})", re.IGNORECASE),
    # Bare 32-char hex string on its own line (last resort)
    re.compile(r"(?:^|\s)([0-9a-f]{32})(?:\s|$)"),
]


def extract_job_id(stdout: str, stderr: str) -> str | None:
    """
    Attempt to extract a Flink job ID from CLI output.

    Searches both stdout and stderr because some Flink versions write
    the job ID to stderr rather than stdout.

    Parameters
    ----------
    stdout:
        Captured standard output from `flink run`.
    stderr:
        Captured standard error from `flink run`.

    Returns
    -------
    str | None
        A 32-character hex job ID, or ``None`` if not found.
    """
    combined = f"{stdout}\n{stderr}"
    for pattern in _JOB_ID_PATTERNS:
        match = pattern.search(combined)
        if match:
            return match.group(1).lower()
    return None
