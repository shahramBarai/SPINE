"""
core/validation/bundle_structure.py – Verify bundle paths exist.
"""

from __future__ import annotations

from pathlib import Path

from app.schemas import SubmitRequest, ValidationStep, BundleValidationError


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
