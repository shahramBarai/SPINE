"""
zip_handler.py – Validation and extraction of zip file job bundles.

This module provides functions to:
  1. Validate zip file integrity, size, and contents
  2. Extract zip contents to a temporary directory
  3. Clean up extracted temporary files
"""

from __future__ import annotations

import shutil
import uuid
import zipfile
from io import BytesIO
from pathlib import Path

from app.utils import config, get_logger

logger = get_logger(__name__)

def validate_zip_file(file_bytes: bytes, max_size_mb: int = None) -> dict:
    """
    Validate a zip file for integrity, size, and content restrictions.

    Parameters
    ----------
    file_bytes : bytes
        Raw bytes of the zip file.
    max_size_mb : int, optional
        Maximum allowed file size in MB. Defaults to config.MAX_ZIP_SIZE_MB.

    Returns
    -------
    dict
        Validation metadata with keys:
          - 'is_valid': bool
          - 'error': str | None (error message if not valid)
          - 'file_list': list[str] (files found in zip)
          - 'has_main_py': bool
          - 'has_requirements_txt': bool
          - 'has_modules_folder': bool

    Zip Structure
    -------------
    Root level (strict whitelist):
      - main.py (REQUIRED at root)
      - requirements.txt (OPTIONAL at root)
      - modules/ folder (OPTIONAL): can contain only .py files with no subdirectories
    
    All other files are rejected.
    """

    result = {
        "is_valid": False,
        "error": None,
        "file_list": [],
        "has_main_py": False,
        "has_requirements_txt": False,
        "has_modules_folder": False,
    }


    if max_size_mb is None:
        max_size_mb = config.MAX_ZIP_SIZE_MB

    # Check file size
    file_size_mb = len(file_bytes) / (1024 * 1024)
    if file_size_mb > max_size_mb:
        error_msg = (
            f"Zip file size ({file_size_mb:.2f} MB) exceeds "
            f"maximum allowed size ({max_size_mb} MB)"
        )
        logger.error(error_msg)
        result["error"] = error_msg
        return result

    # Check zip integrity
    try:
        with zipfile.ZipFile(BytesIO(file_bytes), "r") as zf:
            # testzip() returns the first bad file or None if all ok
            bad_file = zf.testzip()
            if bad_file is not None:
                error_msg = f"Zip file is corrupted: bad file {bad_file}"
                logger.error(error_msg)
                result["error"] = error_msg
                return result

            # Get all files in the zip
            result["file_list"] = zf.namelist()

            # Validate zip structure:
            # Root level: ONLY main.py (required) and requirements.txt (optional)
            # Optional: modules/ folder containing only .py files (no subdirectories)
            
            allowed_root_files = {"main.py", "requirements.txt"}
            
            for fname in result["file_list"]:
                # Check for nested directories
                has_path_sep = "/" in fname or "\\" in fname
                
                if has_path_sep:
                    # Allow modules/ subdirectory only
                    is_in_modules = fname.startswith("modules/") or fname.startswith("modules\\")
                    if not is_in_modules:
                        error_msg = (
                            f"Nested directories not allowed (except 'modules/'). "
                            f"Found: {fname}"
                        )
                        logger.error(error_msg)
                        result["error"] = error_msg
                        return result
                    
                    # For files in modules/, validate structure
                    # Must be modules/{filename}.py with no further nesting
                    relative_path = fname.replace("\\", "/")
                    parts = relative_path.split("/")
                    
                    if len(parts) != 2 or parts[0] != "modules":
                        error_msg = (
                            f"Files in 'modules/' folder must be at root level of that folder "
                            f"(no subdirectories). Found: {fname}"
                        )
                        logger.error(error_msg)
                        result["error"] = error_msg
                        return result

                    # Only .py files allowed in modules/
                    if parts[1] != "" and not parts[1].endswith(".py"):
                        error_msg = (
                            f"Only .py files allowed in 'modules/' folder. "
                            f"Found: {fname}"
                        )
                        logger.error(error_msg)
                        result["error"] = error_msg
                        return result
                else:
                    # Only specified files allowed at root level
                    if fname not in allowed_root_files:
                        error_msg = (
                            f"File '{fname}' is not allowed at root level. "
                            f"Only 'main.py' (required) and 'requirements.txt' (optional) "
                            f"are allowed at root. Additional modules must go in 'modules/' folder."
                        )
                        logger.error(error_msg)
                        result["error"] = error_msg
                        return result

            # Check for main.py
            has_main_py = "main.py" in result["file_list"]
            if not has_main_py:
                error_msg = (
                    "Zip file must contain a 'main.py' file at the root level"
                )
                logger.error(error_msg)
                result["error"] = error_msg
                return result

            has_requirements_txt = "requirements.txt" in result["file_list"]
            has_modules_folder = any(f.startswith("modules/") for f in result["file_list"])

            logger.info(
                f"Zip validation passed. Files: {len(result['file_list'])}, "
                f"main.py: present, requirements.txt: {has_requirements_txt}, "
                f"modules folder: {has_modules_folder}"
            )
            result["is_valid"] = True
            result["has_main_py"] = has_main_py
            result["has_requirements_txt"] = has_requirements_txt
            result["has_modules_folder"] = has_modules_folder
    except zipfile.BadZipFile as exc:
        error_msg = f"Zip file is invalid or corrupted: {exc}"
        logger.error(error_msg)
        result["is_valid"] = False
        result["error"] = error_msg
    
    return result


def extract_zip_to_temp(
    file_bytes: bytes, session_id: str = None
) -> str | None:
    """
    Extract zip file contents to a temporary directory.

    Parameters
    ----------
    file_bytes : bytes
        Raw bytes of the zip file.
    session_id : str, optional
        Unique session identifier for the extraction directory.
        If not provided, a UUID will be generated.

    Returns
    -------
    str
        Absolute path to the extraction directory.
    # or None if extraction fails.
    """
    if session_id is None:
        session_id = str(uuid.uuid4())

    # Ensure temp directory exists
    temp_dir = Path(config.TEMP_EXTRACTION_DIR)
    temp_dir.mkdir(parents=True, exist_ok=True)

    # Create session-specific extraction directory
    extraction_path = temp_dir / session_id
    extraction_path.mkdir(parents=True, exist_ok=True)

    try:
        with zipfile.ZipFile(BytesIO(file_bytes), "r") as zf:
            zf.extractall(path=str(extraction_path))
        logger.info(f"Zip file extracted to {extraction_path}")
        return str(extraction_path)
    except Exception as exc:
        logger.error(f"Failed to extract zip file: {exc}")
        # Clean up on failure
        if extraction_path.exists():
            shutil.rmtree(extraction_path)
        return None


def cleanup_extraction(extraction_path: str) -> None:
    """
    Remove the extracted temporary directory and its contents.

    Parameters
    ----------
    extraction_path : str
        Absolute path to the extraction directory.
    """
    try:
        path = Path(extraction_path)
        if path.exists():
            shutil.rmtree(path)
            logger.info(f"Cleaned up extraction directory: {extraction_path}")
    except Exception as exc:
        logger.error(f"Failed to clean up extraction directory: {exc}")
