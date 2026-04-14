"""
config.py – Configuration defaults for the Flink submission worker.

Values can be overridden via environment variables at runtime.
"""

import os

# ---------------------------------------------------------------------------
# Logging level (DEV or PROD)
# ---------------------------------------------------------------------------

LOG_LEVEL: str = os.getenv("LOG_LEVEL", "DEV")

# ---------------------------------------------------------------------------
# Flink defaults
# ---------------------------------------------------------------------------

# Default JobManager REST address. Override with FLINK_JOBMANAGER env var.
JOBMANAGER_ADDRESS: str = os.getenv("FLINK_JOBMANAGER", "jobmanager:8081")

# Path to the 'flink' CLI binary. Override with FLINK_BIN env var.
# Inside a Flink-compatible Docker image this will be on PATH automatically.
FLINK_BIN: str = os.getenv("FLINK_BIN", "flink")

# ---------------------------------------------------------------------------
# Subprocess timeouts (seconds)
# ---------------------------------------------------------------------------

# Timeout for Python pre-submit checks (AST syntax checks, import).
CHECK_TIMEOUT: int = int(os.getenv("CHECK_TIMEOUT", "30"))

# Timeout for the `flink run` command itself.
SUBMIT_TIMEOUT: int = int(os.getenv("SUBMIT_TIMEOUT", "120"))

# ---------------------------------------------------------------------------
# Zip file handling
# ---------------------------------------------------------------------------

# Maximum allowed zip file size in MB
MAX_ZIP_SIZE_MB: int = int(os.getenv("MAX_ZIP_SIZE_MB", "1"))

# Allowed file extensions within zip (comma-separated)
ALLOWED_ZIP_EXTENSIONS: list[str] = os.getenv(
    "ALLOWED_ZIP_EXTENSIONS", ".py,.txt"
).split(",")

# Timeout for extracting zip files (seconds)
ZIP_EXTRACT_TIMEOUT: int = int(os.getenv("ZIP_EXTRACT_TIMEOUT", "30"))

# Directory for extracting temporary zip files
TEMP_EXTRACTION_DIR: str = os.getenv("TEMP_EXTRACTION_DIR", "/tmp/flink-submissions")

# ---------------------------------------------------------------------------
# Service metadata
# ---------------------------------------------------------------------------

SERVICE_NAME: str = "flink-submission-worker"
SERVICE_VERSION: str = "0.1.0"
