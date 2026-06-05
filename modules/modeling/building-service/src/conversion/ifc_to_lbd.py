
from __future__ import annotations

import json
import subprocess
from pathlib import Path

from pydantic import BaseModel

from utils import file_utils
from datetime import datetime, timezone
from typing import Any
import threading
import uuid

# --- Constants and configuration ---
root_dir = file_utils.get_source_root()
HW_CONFIG_JSON_PATH = root_dir / "java_files" / "config.json"
JAR_FILE_PATH = root_dir / "java_files" / "IFCtoLBD_CLI.jar"

# --- In-memory job tracking ---
_CONVERSION_JOBS: dict[str, dict[str, Any]] = {}
_CONVERSION_JOBS_LOCK = threading.Lock()

def get_hardware_config() -> list:
    """
    Reads the hardware configuration from the config.json file.

    Returns:
        A list of hardware configuration options, otherwise an empty list.
    """
    if not HW_CONFIG_JSON_PATH.exists():
        return []
    
    try:
        with open(HW_CONFIG_JSON_PATH, 'r') as file:
            config = json.load(file)
            return config.get("hardware", [])
    except Exception:
        return []

class IfcToLbdOptions(BaseModel):
    level: int = 1
    ifcOWL: bool = False
     

def run_conversion(source_file: Path, target_file: Path, options: IfcToLbdOptions | None = IfcToLbdOptions()) -> bool:
    """
    Runs the IFC to LBD conversion using the Java CLI tool.

    **Args**
        source_file: The path to the source IFC file
        target_file: The path where the output TTL file should be saved
        options: Optional conversion options (e.g., level of detail, ifcOWL flag)
    **Returns**
        True if the conversion was successful, False otherwise
    """
    hw_config = get_hardware_config()

    command = ["java"]
    command.extend(hw_config)
    command.extend(["-jar", str(JAR_FILE_PATH)])
    
    # Path objects need to be converted to strings for subprocess
    command.append(str(source_file))
    command.extend(["--level", str(options.level)])
    
    if options.ifcOWL:
        command.append("--ifcOWL")
        
    command.extend(["--target_file", str(target_file)])

    print(f"\nProcessing: {source_file.name} -> {target_file.name}")
    
    try:
        subprocess.run(command, check=True)
        print(f"Successfully converted {source_file.name}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"Failed to convert {source_file.name}. Exit code: {e.returncode}")
        return False


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _set_job(job_id: str, **updates: Any) -> None:
    with _CONVERSION_JOBS_LOCK:
        current = _CONVERSION_JOBS.get(job_id, {})
        current.update(updates)
        current.setdefault("job_id", job_id)
        _CONVERSION_JOBS[job_id] = current

def _run_conversion_job(job_id: str, source_path: Path, target_path: Path) -> None:
    _set_job(job_id, status="running", updated_at=_utc_now())
    try:
        converted = run_conversion(source_path, target_path)
        if converted:
            _set_job(
                job_id,
                status="completed",
                updated_at=_utc_now(),
            )
            return

        _set_job(
            job_id,
            status="failed",
            error="Conversion failed for the provided IFC file.",
            updated_at=_utc_now(),
        )
    except Exception as exc:
        _set_job(
            job_id,
            status="failed",
            error=str(exc),
            updated_at=_utc_now(),
        )

def run_conversion_in_background(source_path: Path, target_path: Path) -> str:
    job_id = uuid.uuid4().hex
    now = _utc_now()

    _set_job(
        job_id,
        status="queued",
        source_file=str(source_path),
        target_ttl=str(target_path),
        error=None,
        created_at=now,
        updated_at=now,
    )

    thread = threading.Thread(
        target=_run_conversion_job,
        args=(job_id, source_path, target_path),
        daemon=True,
    )
    thread.start()

    return job_id

def get_job(job_id: str) -> dict[str, Any] | None:
    with _CONVERSION_JOBS_LOCK:
        job = _CONVERSION_JOBS.get(job_id)
        return dict(job) if job is not None else None
    
def get_all_jobs() -> list[dict[str, Any]]:
    with _CONVERSION_JOBS_LOCK:
        return [dict(job) for job in _CONVERSION_JOBS.values()]