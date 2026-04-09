"""
core/validation/import_check.py – Import module testing with PYTHONPATH injection.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

from app.utils import config
from app.schemas import ValidationStep


def _run(
    cmd: list[str],
    *,
    cwd: str | None = None,
    env: dict[str, str] | None = None,
    timeout: int = config.CHECK_TIMEOUT,
) -> subprocess.CompletedProcess[str]:
    """Run a subprocess and return the completed process object."""
    return subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        cwd=cwd,
        env=env,
        timeout=timeout,
    )


def _step(
    name: str,
    cmd: list[str],
    proc: subprocess.CompletedProcess[str],
    detail: str = "",
) -> ValidationStep:
    """Build a ValidationStep from a completed subprocess result."""
    return ValidationStep(
        step=name,
        command=cmd,
        success=(proc.returncode == 0),
        stdout=proc.stdout.strip(),
        stderr=proc.stderr.strip(),
        detail=detail,
    )


def run_import_check(entrypoint: str, pyfiles_path: str | None) -> ValidationStep:
    """
    Try to import the entrypoint module with ``pyfiles_path`` on ``PYTHONPATH``.

    The entrypoint ``main.py`` imports from ``spine_job.*`` which lives under
    ``pyfiles/``.  We simulate Flink's ``--pyFiles`` behaviour by injecting the
    directory onto ``PYTHONPATH`` before running a bare import check.

    The check runs in an isolated subprocess so it cannot pollute the worker
    process if the bundle has side-effects at module level.

    Parameters
    ----------
    entrypoint:
        Absolute path to the bundle's ``main.py``.
    pyfiles_path:
        Absolute path to the bundle's ``pyfiles`` directory, or ``None``.

    Returns
    -------
    ValidationStep
        Result of the import check.
    """
    ep = Path(entrypoint)
    module_name = ep.stem  # "main.py" → "main"
    ep_dir = str(ep.parent)  # directory that contains main.py

    # Build PYTHONPATH: pyfiles dir + entrypoint's own dir + existing PATH
    extra_paths: list[str] = [ep_dir]
    if pyfiles_path is not None:
        extra_paths.insert(0, pyfiles_path)

    env = os.environ.copy()
    existing_pp = env.get("PYTHONPATH", "")
    all_paths = os.pathsep.join(filter(None, [*extra_paths, existing_pp]))
    env["PYTHONPATH"] = all_paths

    # Use `python -c "import <module>"` instead of `-m` to avoid executing
    # the `if __name__ == '__main__':` block.
    code = f"import {module_name}"
    cmd = [sys.executable, "-B", "-c", code]

    try:
        proc = _run(cmd, cwd=ep_dir, env=env)
    except subprocess.TimeoutExpired:
        return ValidationStep(
            step="import_check.entrypoint",
            command=cmd,
            success=False,
            stderr="import check timed out",
        )

    step = _step("import_check.entrypoint", cmd, proc)
    step.detail = f"PYTHONPATH={all_paths}"
    return step
