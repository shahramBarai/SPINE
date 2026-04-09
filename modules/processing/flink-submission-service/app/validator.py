"""
validator.py – Pre-submit validation for a Flink job bundle.

Validation is performed in these ordered steps:
  1. Bundle path checks  (files / directories exist)
    2. Python syntax check on entrypoint   (ast.parse)
    3. Python syntax check on pyfiles dir  (ast.parse)
  4. Import check on entrypoint          (PYTHONPATH injection)

Each step returns a ValidationStep dict so the caller can surface
full detail to the upstream service.
"""

from __future__ import annotations

import ast
import os
import subprocess
import sys
from pathlib import Path

from app.exceptions import BundleValidationError
from app.models import SubmitRequest, ValidationResult, ValidationStep
from app import settings


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _run(
    cmd: list[str],
    *,
    cwd: str | None = None,
    env: dict[str, str] | None = None,
    timeout: int = settings.CHECK_TIMEOUT,
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


# ---------------------------------------------------------------------------
# Public validators
# ---------------------------------------------------------------------------


def validate_bundle_structure(request: SubmitRequest) -> list[ValidationStep]:
    """
    Check that all referenced bundle paths exist on the filesystem.

    No subprocess is needed for this step; we use ``pathlib``.

    Parameters
    ----------
    request:
        The incoming submit request with path fields.

    Returns
    -------
    list[ValidationStep]
        One step for each path that was checked.

    Raises
    ------
    BundleValidationError
        If the entrypoint does not exist or is not a file.
    """
    steps: list[ValidationStep] = []

    # -- entrypoint ----------------------------------------------------------
    ep = Path(request.entrypoint)
    ep_ok = ep.is_file()
    steps.append(
        ValidationStep(
            step="bundle.entrypoint_exists",
            command=[],
            success=ep_ok,
            detail=str(ep),
            stderr="" if ep_ok else f"Entrypoint not found or not a file: {ep}",
        )
    )
    if not ep_ok:
        raise BundleValidationError(f"Entrypoint not found: {ep}")

    # -- pyfiles_path --------------------------------------------------------
    if request.pyfiles_path is not None:
        pf = Path(request.pyfiles_path)
        pf_ok = pf.is_dir()
        steps.append(
            ValidationStep(
                step="bundle.pyfiles_path_exists",
                command=[],
                success=pf_ok,
                detail=str(pf),
                stderr="" if pf_ok else f"pyfiles_path not found or not a dir: {pf}",
            )
        )
        if not pf_ok:
            raise BundleValidationError(f"pyfiles_path not found: {pf}")

    # -- requirements_path ---------------------------------------------------
    if request.requirements_path is not None:
        rp = Path(request.requirements_path)
        rp_ok = rp.is_file()
        steps.append(
            ValidationStep(
                step="bundle.requirements_path_exists",
                command=[],
                success=rp_ok,
                detail=str(rp),
                stderr=(
                    "" if rp_ok else f"requirements_path not found or not a file: {rp}"
                ),
            )
        )
        if not rp_ok:
            raise BundleValidationError(f"requirements_path not found: {rp}")

    return steps


def run_py_compile_check(entrypoint: str) -> ValidationStep:
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
    ValidationStep
        Result of the entrypoint syntax check.
    """
    cmd: list[str] = []
    try:
        ep = Path(entrypoint)
        source = ep.read_text(encoding="utf-8")
        ast.parse(source, filename=str(ep))
    except SyntaxError as exc:
        return ValidationStep(
            step="py_compile.entrypoint",
            command=cmd,
            success=False,
            stderr=(
                f"{exc.msg} at line {exc.lineno}, column {exc.offset}"
                if exc.lineno is not None
                else exc.msg
            ),
            detail=str(entrypoint),
        )
    except Exception as exc:
        return ValidationStep(
            step="py_compile.entrypoint",
            command=cmd,
            success=False,
            stderr=str(exc),
            detail=str(entrypoint),
        )

    return ValidationStep(
        step="py_compile.entrypoint",
        command=cmd,
        success=True,
        detail=str(entrypoint),
    )


def run_compileall_check(pyfiles_path: str) -> ValidationStep:
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
    ValidationStep
        Result of the pyfiles syntax check.
    """
    cmd: list[str] = []
    try:
        root = Path(pyfiles_path)
        for py_file in sorted(root.rglob("*.py")):
            source = py_file.read_text(encoding="utf-8")
            ast.parse(source, filename=str(py_file))
    except SyntaxError as exc:
        return ValidationStep(
            step="compileall.pyfiles",
            command=cmd,
            success=False,
            stderr=(
                f"{exc.filename}: {exc.msg} at line {exc.lineno}, column {exc.offset}"
                if exc.lineno is not None
                else exc.msg
            ),
            detail=str(pyfiles_path),
        )
    except Exception as exc:
        return ValidationStep(
            step="compileall.pyfiles",
            command=cmd,
            success=False,
            stderr=str(exc),
            detail=str(pyfiles_path),
        )

    return ValidationStep(
        step="compileall.pyfiles",
        command=cmd,
        success=True,
        detail=str(pyfiles_path),
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


# ---------------------------------------------------------------------------
# Aggregate runner
# ---------------------------------------------------------------------------


def run_pre_submit_checks(request: SubmitRequest) -> ValidationResult:
    """
    Execute all pre-submit validation steps in order.

    Stops at the first failing step so that errors do not cascade.

    Parameters
    ----------
    request:
        The incoming submit request.

    Returns
    -------
    ValidationResult
        Aggregated result with per-step details.
    """
    all_steps: list[ValidationStep] = []

    # 1. Bundle path validation (raises BundleValidationError on failure)
    try:
        structure_steps = validate_bundle_structure(request)
        all_steps.extend(structure_steps)
    except BundleValidationError as exc:
        # Include whatever steps ran before the failure
        return ValidationResult(
            success=False,
            steps=all_steps,
            error=str(exc),
        )

    # 2. AST syntax check on entrypoint
    compile_step = run_py_compile_check(request.entrypoint)
    all_steps.append(compile_step)
    if not compile_step.success:
        return ValidationResult(
            success=False,
            steps=all_steps,
            error="Syntax check failed on entrypoint (AST parse)",
        )

    # 3. AST syntax check on pyfiles
    if request.pyfiles_path is not None:
        compileall_step = run_compileall_check(request.pyfiles_path)
        all_steps.append(compileall_step)
        if not compileall_step.success:
            return ValidationResult(
                success=False,
                steps=all_steps,
                error="Syntax check failed on pyfiles (AST parse)",
            )

    # 4. Import check
    import_step = run_import_check(request.entrypoint, request.pyfiles_path)
    all_steps.append(import_step)
    if not import_step.success:
        return ValidationResult(
            success=False,
            steps=all_steps,
            error="Import check failed on entrypoint",
        )

    return ValidationResult(success=True, steps=all_steps)
