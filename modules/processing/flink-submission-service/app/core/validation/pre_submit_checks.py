"""
pre_submit_checks.py – Orchestration of pre-submission validation pipeline.

Executes all validation steps (bundle structure, syntax checks, import checks)
in order, stopping at the first failure.
"""

from __future__ import annotations

import os
import sys
import subprocess
import ast
from pathlib import Path

from app.schemas import SubmitRequest, ValidationResult
from app.utils import get_logger, config

logger = get_logger(__name__)

def run_pre_submit_checks(request: SubmitRequest) -> ValidationResult:
    """
    Execute all pre-submit validation steps in order.

    Stops at the first failing step so that errors do not cascade.

    Parameters
    ----------
    request : SubmitRequest
        The incoming submit request containing entrypoint and optional
        pyfiles_path and requirements_path.

    Returns
    -------
    ValidationResult
        - success: True if all checks passed, False if any check failed.
        - error: If success is False, contains a message about the first failure.

    Workflow
    --------
    1. Bundle path validation (files/directories exist)
    2. Python syntax check on entrypoint (ast.parse)
    3. Python syntax check on pyfiles directory (ast.parse)
    4. Import check on entrypoint (PYTHONPATH injection)
    """
    all_steps = []

    # 1. Bundle path validation (files/directories exist)
    bundle_step = _validate_bundle_structure(request)
    if not bundle_step.success:
        return bundle_step

    # 2. AST syntax check on entrypoint
    compile_step = _run_py_compile_check(request.entrypoint)
    if not compile_step.success:
        return compile_step

    # 3. AST syntax check on pyfiles
    if request.pyfiles_path is not None:
        compileall_step = _run_compileall_check(request.pyfiles_path)
        if not compileall_step.success:
            return compileall_step
        
    # 4. Import check
    import_step = _run_import_check(request.entrypoint, request.pyfiles_path)
    if not import_step.success:
        return import_step

    return ValidationResult(success=True, error=None)


def _validate_bundle_structure(request: SubmitRequest) -> ValidationResult:
    """
    Check that all referenced bundle paths exist on the filesystem.

    No subprocess is needed for this step; we use ``pathlib``.

    Parameters
    ----------
    request:
        The incoming submit request with path fields.

    Returns
    -------
    ValidationResult
        - success: True if all paths are valid, False if any are missing.
        - error: If success is False, contains a message about the first missing path.
    """

    # -- entrypoint ----------------------------------------------------------
    ep = Path(request.entrypoint)
    ep_ok = ep.is_file()

    if not ep_ok:
        return ValidationResult(
            success=False,
            error=f"Entrypoint not found: {ep}",
        )

    # -- pyfiles_path --------------------------------------------------------
    if request.pyfiles_path is not None:
        pf = Path(request.pyfiles_path)
        pf_ok = pf.is_dir()
        if not pf_ok:
            return ValidationResult(
                success=False,
                error=f"pyfiles_path not found: {pf}",
            )

    # -- requirements_path ---------------------------------------------------
    if request.requirements_path is not None:
        rp = Path(request.requirements_path)
        rp_ok = rp.is_file()
        if not rp_ok:
            return ValidationResult(
                success=False,
                error=f"requirements_path not found: {rp}",
            )
    
    return ValidationResult(success=True, error=None)

def _run_py_compile_check(entrypoint: str) -> ValidationResult:
    """
    Parse the entrypoint script using ``ast.parse`` (read-only).

    This detects syntax errors in ``main.py`` without executing it and
    without creating ``__pycache__`` files.

    Parameters
    ----------
    entrypoint:
        Absolute path to the bundle's ``main.py``.

    Returns
    -------
    ValidationResult
        - success: True if the entrypoint has valid syntax, False if a syntax error is detected.
        - error: If success is False, contains a message about the syntax error.
    """
    try:
        ep = Path(entrypoint)
        source = ep.read_text(encoding="utf-8")
        ast.parse(source, filename=str(ep))
    except SyntaxError as exc:
        return ValidationResult(
            success=False,
            error=(
                f"{exc.filename}: {exc.msg} at line {exc.lineno}, column {exc.offset}"
                if exc.lineno is not None
                else exc.msg
            ),
        )
    except Exception as exc:
        return ValidationResult(
            success=False,
            error=str(exc),
        )

    return ValidationResult(
        success=True,
        error=None,
    )

def _run_compileall_check(pyfiles_path: str) -> ValidationResult:
    """
    Parse all Python files under ``pyfiles_path`` using ``ast.parse``.

    This detects syntax errors in all modules under the ``pyfiles/`` tree
    without creating bytecode files.

    Parameters
    ----------
    pyfiles_path:
        Absolute path to the bundle's ``pyfiles`` directory.

    Returns
    -------
    ValidationResult
        - success: True if all .py files have valid syntax, False if any syntax error is detected.
        - error: If success is False, contains a message about the first syntax error encountered.
    """
    try:
        root = Path(pyfiles_path)
        for py_file in sorted(root.rglob("*.py")):
            source = py_file.read_text(encoding="utf-8")
            ast.parse(source, filename=str(py_file))
    except SyntaxError as exc:
        return ValidationResult(
            success=False,
            error=(
                f"{exc.filename}: {exc.msg} at line {exc.lineno}, column {exc.offset}"
                if exc.lineno is not None
                else exc.msg
            ),
        )
    except Exception as exc:
        return ValidationResult(
            success=False,
            error=str(exc),
        )
    
    return ValidationResult(
        success=True,
        error=None,
    )

def _run_import_check(entrypoint: str, pyfiles_path: str | None) -> ValidationResult:
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
    ValidationResult
        - success: True if the import check passes, False if it fails.
        - error: If success is False, contains the stderr output from the import check.
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
        # Run a subprocess and return the complete process object.
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=ep_dir,
            env=env,
            timeout=config.CHECK_TIMEOUT,
        )
    except subprocess.TimeoutExpired:
        return ValidationResult(
            success=False,
            error="Import check timed out",
        )

    return ValidationResult(
        success=proc.returncode == 0,
        error=proc.stderr.strip() if proc.returncode != 0 else None,
    )
