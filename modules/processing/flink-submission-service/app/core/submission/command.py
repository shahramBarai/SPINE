"""
core/submission/command.py – Build the `flink run --detached` command.
"""

from __future__ import annotations

from app.utils import config
from app.schemas import SubmitRequest


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
        config.FLINK_BIN,
        "run",
        "--detached",
        "--jobmanager",
        config.JOBMANAGER_ADDRESS,
        "--python",
        request.entrypoint,
    ]

    if request.pyfiles_path is not None:
        cmd += ["--pyFiles", request.pyfiles_path]

    if request.requirements_path is not None:
        cmd += ["--pyRequirements", request.requirements_path]

    return cmd
