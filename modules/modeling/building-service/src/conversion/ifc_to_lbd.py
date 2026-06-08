
from __future__ import annotations

import json
import subprocess
from pathlib import Path

from pydantic import BaseModel

from enum import StrEnum
from utils import file_utils
from datetime import datetime, timezone
import threading
import uuid

# --- Constants and configuration ---
root_dir = file_utils.get_source_root()
HW_CONFIG_JSON_PATH = root_dir / "java_files" / "config.json"
JAR_FILE_PATH = root_dir / "java_files" / "IFCtoLBD_CLI.jar"

HW_CONFIG = file_utils.get_hardware_config(HW_CONFIG_JSON_PATH)

# --- Data models ---
class JobStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"

class IfcToLbdOptions(BaseModel):
    level: int = 1
    ifcOWL: bool = False

class ConversionJobDetails(BaseModel):
    source_file: Path
    target_ttl: Path
    IfcToLbdOptions: IfcToLbdOptions

class ConversionJobStatus(BaseModel):
    status: JobStatus
    error: str | None = None
    updated_at: str

class ConversionJob(BaseModel):
    job_id: str
    details: ConversionJobDetails
    status_info: ConversionJobStatus
    created_at: str

# --- In-memory job tracking ---
_CONVERSION_JOBS: dict[str, ConversionJob] = {}
_CONVERSION_JOBS_LOCK = threading.Lock()

_THREAD_POOL: list[threading.Thread] = []

# --- Helper functions ---

def _utc_now() -> str:
    """Returns the current UTC time as an ISO-formatted string."""
    return datetime.now(timezone.utc).isoformat()

def _update_job_status(job_id: str, status: JobStatus, error: str | None = None) -> ConversionJob | None:
    """Updates the status of a conversion job in a thread-safe manner."""
    with _CONVERSION_JOBS_LOCK:
        current = _CONVERSION_JOBS.get(job_id)
        # Only update if the job exists
        if current:
            current.status_info = current.status_info.model_copy(
                update={
                    "status": status,
                    "updated_at": _utc_now(),
                    "error": error,
                }
            )
            _CONVERSION_JOBS[job_id] = current
            return current
    return None

def _run_java_command(source_file: Path, target_file: Path, ifcToLbdOptions: IfcToLbdOptions) -> bool:
    """Runs a Java command using subprocess and returns True if successful, False otherwise."""

    command = ["java"]
    command.extend(HW_CONFIG)   # Add hardware configuration options if available
    command.extend(["-jar", str(JAR_FILE_PATH)])
    
    # Path objects need to be converted to strings for subprocess
    command.append(str(source_file))
    command.extend(["--level", str(ifcToLbdOptions.level)])
    
    if ifcToLbdOptions.ifcOWL:
        command.append("--ifcOWL")

    command.extend(["--target_file", str(target_file)])

    try:
        subprocess.run(command, check=True)
        return True
    except subprocess.CalledProcessError as e:
        print(f"Failed to convert {source_file.name}. Exit code: {e.returncode}")
        return False

def _run_conversion(job_id: str) -> None:
    """
    This function is intended to be run in a background thread. It retrieves the job details, 
    executes the conversion command, and updates the job status accordingly.
    """
    job = _update_job_status(job_id, status=JobStatus.RUNNING)

    if job is None:
        return  # Job not found, cannot proceed

    is_successful = _run_java_command(
        job.details.source_file, 
        job.details.target_ttl, 
        job.details.IfcToLbdOptions
    )

    _update_job_status(
        job_id,
        status=JobStatus.COMPLETED if is_successful else JobStatus.FAILED,
        error=None if is_successful else f"Conversion failed for {job.details.source_file.name}."
    )

# --- Main conversion logic ---

def get_job_id(source_path: Path) -> str | None:
    """
    Retrieves the ID of a conversion job by its source file path.

    **Args**:
        source_path (Path): The path to the source IFC file.

    **Returns**:
        str | None: The ID of the job or None if not found.
    """
    with _CONVERSION_JOBS_LOCK:
        for job_id, job in _CONVERSION_JOBS.items():
            if job.details.source_file == source_path:
                return job_id
    return None

def get_job(job_id: str) -> ConversionJob | None:
    """
    Retrieves a conversion job by its ID in a thread-safe manner.

    **Args**:
        job_id (str): The ID of the job to retrieve.
    **Returns**:
        ConversionJob | None: The retrieved job or None if not found.
    """
    with _CONVERSION_JOBS_LOCK:
        return _CONVERSION_JOBS.get(job_id)
    
def get_all_jobs() -> list[ConversionJob]:
    """
    Retrieves all conversion jobs in a thread-safe manner.
    
    **Returns**:
        list[ConversionJob]: A list of all conversion jobs.
    """
    with _CONVERSION_JOBS_LOCK:
        return list(_CONVERSION_JOBS.values())

def run_conversion_in_background(source_path: Path, target_path: Path, ifcToLbdOptions: IfcToLbdOptions = IfcToLbdOptions()) -> str:
    """
    Initiates the conversion of an IFC file to TTL format in a background thread.

    **Args**:
        source_path (Path): The path to the source IFC file.
        target_path (Path): The path where the converted TTL file should be saved.
        ifcToLbdOptions (IfcToLbdOptions): Optional conversion options (defaults to level 1 and ifcOWL false).
    **Returns**:
        str: The ID of the created conversion job.
    """
    job_id = uuid.uuid4().hex
    now = _utc_now()

    # Create a new job entry with status "queued"
    new_job = ConversionJob(
        job_id=job_id,
        details=ConversionJobDetails(
            source_file=source_path,
            target_ttl=target_path,
            IfcToLbdOptions=ifcToLbdOptions
        ),
        status_info=ConversionJobStatus(
            status=JobStatus.QUEUED,
            error=None,
            updated_at=now
        ),
        created_at=now
    )
    with _CONVERSION_JOBS_LOCK:
        _CONVERSION_JOBS[job_id] = new_job

    thread = threading.Thread(
        target=_run_conversion,
        args=(job_id,)
    )

    _THREAD_POOL.append(thread)

    thread.start()

    return job_id