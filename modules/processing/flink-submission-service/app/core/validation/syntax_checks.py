"""
core/validation/syntax_checks.py – AST-based Python syntax checking.
"""

from __future__ import annotations

import ast
from pathlib import Path

from app.schemas import ValidationStep


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
