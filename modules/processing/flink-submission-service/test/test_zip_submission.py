#!/usr/bin/env python3
"""
test_zip_submission.py – Integration tests for zip submission feature.

This test verifies:
  1. Valid zip structures are accepted
  2. Invalid zip structures are rejected
  3. Zip extraction and cleanup work correctly
  4. Detailed validation error messages

Valid structures:
  - main.py
  - main.py + requirements.txt
  - main.py + modules/*.py
  - main.py + requirements.txt + modules/*.py

Invalid structures:
  - Missing main.py
  - Extra files at root (besides main.py and requirements.txt)
  - Invalid file types at root or in modules/
  - Nested directories
"""

import io
import sys
from pathlib import Path

import zipfile

# Add the app module to path
sys.path.insert(0, str(Path(__file__).parent))

from app.core.validation.zip_handler import (
    validate_zip_file,
    extract_zip_to_temp,
    cleanup_extraction
)


def create_zip_with_files(files_dict) -> bytes:
    """
    Create a test zip file with specified files.
    
    Parameters
    ----------
    files_dict : dict
        Dict mapping file paths to file contents.
        e.g., {"main.py": "code", "modules/helper.py": "more code"}
    """
    bio = io.BytesIO()
    with zipfile.ZipFile(bio, "w") as zf:
        for path, content in files_dict.items():
            zf.writestr(path, content)
    bio.seek(0)
    return bio.getvalue()


def get_validation_error(zip_bytes: bytes) -> str:
    """Return the validation error message for an invalid zip, regardless of contract style."""

    result = validate_zip_file(zip_bytes)
    if isinstance(result, dict) and not result.get("is_valid", False):
        return result.get("error") or "Zip validation failed"
    return "Zip validation unexpectedly passed"


def test_valid_main_py_only():
    """Test that main.py alone is valid."""
    print("Test 1: Valid zip with main.py only...")
    try:
        zip_bytes = create_zip_with_files({"main.py": "# Flink job code"})
        result = validate_zip_file(zip_bytes)
        assert result["is_valid"], f"Should be valid: {result['error']}"
        assert result["has_main_py"]
        assert not result["has_requirements_txt"]
        assert not result["has_modules_folder"]
        print("  ✓ PASSED")
        return True
    except Exception as e:
        print(f"  ✗ FAILED: {e}")
        return False


def test_valid_main_py_and_requirements():
    """Test that main.py + requirements.txt is valid."""
    print("Test 2: Valid zip with main.py + requirements.txt...")
    try:
        zip_bytes = create_zip_with_files({
            "main.py": "# Flink job",
            "requirements.txt": "apache-flink==1.17.0"
        })
        result = validate_zip_file(zip_bytes)
        assert result["is_valid"], f"Should be valid: {result['error']}"
        assert result["has_main_py"]
        assert result["has_requirements_txt"]
        assert not result["has_modules_folder"]
        print("  ✓ PASSED")
        return True
    except Exception as e:
        print(f"  ✗ FAILED: {e}")
        return False


def test_valid_with_modules_folder():
    """Test that main.py + modules/*.py is valid."""
    print("Test 3: Valid zip with main.py + modules folder...")
    try:
        zip_bytes = create_zip_with_files({
            "main.py": "# Main entry point",
            "modules/utils.py": "# Utilities",
            "modules/helpers.py": "# Helpers"
        })
        result = validate_zip_file(zip_bytes)
        assert result["is_valid"], f"Should be valid: {result['error']}"
        assert result["has_main_py"]
        assert result["has_modules_folder"]
        print("  ✓ PASSED")
        return True
    except Exception as e:
        print(f"  ✗ FAILED: {e}")
        return False


def test_valid_all_files():
    """Test that main.py + requirements.txt + modules/*.py is valid."""
    print("Test 4: Valid zip with main.py + requirements.txt + modules...")
    try:
        zip_bytes = create_zip_with_files({
            "main.py": "# Entry point",
            "requirements.txt": "apache-flink==1.17.0",
            "modules/utils.py": "# Utils",
            "modules/handlers.py": "# Handlers"
        })
        result = validate_zip_file(zip_bytes)
        assert result["is_valid"], f"Should be valid: {result['error']}"
        assert result["has_main_py"]
        assert result["has_requirements_txt"]
        assert result["has_modules_folder"]
        print("  ✓ PASSED")
        return True
    except Exception as e:
        print(f"  ✗ FAILED: {e}")
        return False


def test_invalid_missing_main_py():
    """Test that zip without main.py is rejected."""
    print("Test 5: Invalid - missing main.py...")
    zip_bytes = create_zip_with_files({
        "requirements.txt": "apache-flink==1.17.0"
    })
    error = get_validation_error(zip_bytes)
    if "main.py" in error:
        print("  ✓ PASSED")
        return True
    print(f"  ✗ FAILED: Wrong error message: {error}")
    return False


def test_invalid_extra_py_at_root():
    """Test that extra .py files at root are rejected."""
    print("Test 6: Invalid - extra .py file at root...")
    zip_bytes = create_zip_with_files({
        "main.py": "# Main",
        "helper.py": "# Helper - should go in modules/"
    })
    error = get_validation_error(zip_bytes)
    if "helper.py" in error or "not allowed" in error:
        print("  ✓ PASSED")
        return True
    print(f"  ✗ FAILED: Wrong error message: {error}")
    return False


def test_invalid_extra_txt_at_root():
    """Test that extra .txt files at root are rejected."""
    print("Test 7: Invalid - extra .txt file at root...")
    zip_bytes = create_zip_with_files({
        "main.py": "# Main",
        "config.txt": "some config"
    })
    error = get_validation_error(zip_bytes)
    if "config.txt" in error or "not allowed" in error:
        print("  ✓ PASSED")
        return True
    print(f"  ✗ FAILED: Wrong error message: {error}")
    return False


def test_invalid_other_file_type():
    """Test that other file types are rejected."""
    print("Test 8: Invalid - other file type at root...")
    zip_bytes = create_zip_with_files({
        "main.py": "# Main",
        "script.sh": "#!/bin/bash"
    })
    error = get_validation_error(zip_bytes)
    if "script.sh" in error or "not allowed" in error:
        print("  ✓ PASSED")
        return True
    print(f"  ✗ FAILED: Wrong error message: {error}")
    return False


def test_invalid_non_py_in_modules():
    """Test that non-.py files in modules/ are rejected."""
    print("Test 9: Invalid - non-.py file in modules/...")
    zip_bytes = create_zip_with_files({
        "main.py": "# Main",
        "modules/config.txt": "configuration"
    })
    error = get_validation_error(zip_bytes)
    if "modules/" in error or ".py" in error:
        print("  ✓ PASSED")
        return True
    print(f"  ✗ FAILED: Wrong error message: {error}")
    return False


def test_invalid_nested_modules():
    """Test that nested directories in modules/ are rejected."""
    print("Test 10: Invalid - nested directory in modules/...")
    zip_bytes = create_zip_with_files({
        "main.py": "# Main",
        "modules/subdir/helper.py": "# Nested - not allowed"
    })
    error = get_validation_error(zip_bytes)
    if "subdirectories" in error.lower() or "root level" in error.lower():
        print("  ✓ PASSED")
        return True
    print(f"  ✗ FAILED: Wrong error message: {error}")
    return False


def test_invalid_other_nested_folder():
    """Test that other nested folders are rejected."""
    print("Test 11: Invalid - other nested folder...")
    zip_bytes = create_zip_with_files({
        "main.py": "# Main",
        "src/helper.py": "# Not allowed"
    })
    error = get_validation_error(zip_bytes)
    if "modules/" in error or "not allowed" in error.lower():
        print("  ✓ PASSED")
        return True
    print(f"  ✗ FAILED: Wrong error message: {error}")
    return False


def test_corrupted_zip():
    """Test that corrupted zip is rejected."""
    print("Test 12: Invalid - corrupted zip file...")
    zip_bytes = b"Not a zip file at all!"
    error = get_validation_error(zip_bytes)
    if "corrupted" in error.lower() or "invalid" in error.lower():
        print("  ✓ PASSED")
        return True
    print(f"  ✗ FAILED: Wrong error message: {error}")
    return False


def test_zip_extraction():
    """Test that zip extraction works and cleanup removes files."""
    print("Test 13: Zip extraction and cleanup...")
    try:
        zip_bytes = create_zip_with_files({
            "main.py": "# Main",
            "requirements.txt": "apache-flink==1.17.0",
            "modules/utils.py": "# Utilities"
        })
        
        # Extract
        extraction_path = extract_zip_to_temp(zip_bytes, "test-session-123")
        extraction_dir = Path(extraction_path)
        
        # Verify files exist
        assert (extraction_dir / "main.py").exists(), "main.py not extracted"
        assert (extraction_dir / "requirements.txt").exists(), "requirements.txt not extracted"
        assert (extraction_dir / "modules" / "utils.py").exists(), "modules/utils.py not extracted"
        
        # Cleanup
        cleanup_extraction(extraction_path)
        assert not extraction_dir.exists(), "Directory not cleaned up"
        
        print("  ✓ PASSED")
        return True
    except Exception as e:
        print(f"  ✗ FAILED: {e}")
        return False


def main():
    """Run all tests."""
    print("=" * 70)
    print("Testing Zip Submission Feature - Strict Structure Validation")
    print("=" * 70)
    
    tests = [
        test_valid_main_py_only,
        test_valid_main_py_and_requirements,
        test_valid_with_modules_folder,
        test_valid_all_files,
        test_invalid_missing_main_py,
        test_invalid_extra_py_at_root,
        test_invalid_extra_txt_at_root,
        test_invalid_other_file_type,
        test_invalid_non_py_in_modules,
        test_invalid_nested_modules,
        test_invalid_other_nested_folder,
        test_corrupted_zip,
        test_zip_extraction,
    ]
    
    results = [test() for test in tests]
    
    print("=" * 70)
    passed = sum(results)
    total = len(results)
    print(f"Results: {passed}/{total} tests passed")
    print("=" * 70)
    
    return all(results)


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
