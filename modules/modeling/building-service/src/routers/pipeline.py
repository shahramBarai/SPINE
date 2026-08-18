from __future__ import annotations

from fastapi import APIRouter, File, UploadFile, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path

from utils import file_utils
from conversion import IfcToLbd

MAX_UPLOAD_SIZE = 1000 * 1024 * 1024 # 1000 MB in bytes

# TODO: Integrate file storage (MinIO) instead of using local storage.
TMP_DIR = Path("/tmp/spine_building_service")
TMP_DIR.mkdir(parents=True, exist_ok=True)

router = APIRouter(tags=["Pipelines"])

# TODO: Replace filename with file ID or similar to avoid issues with duplicate filenames and security issues with path traversal.
# This is just a quick implementation for testing purposes.
@router.get("/api/pipeline/download")
def download(filename: str):
    # Check that the filename is valid
    if not file_utils.valid_file_name(filename, allowed_extensions=["ifc", "ttl"]):
        raise HTTPException(status_code=400, detail="Invalid request! Please check the filename and try again.")

    # Only allow downloading files stored in the temporary IFC folder.
    file_name = Path(filename).name
    source_path = TMP_DIR / file_name

    if not source_path.exists() or not source_path.is_file():
        raise HTTPException(status_code=404, detail=f"File not found: {file_name}")

    return FileResponse(
        path=source_path,
        status_code=200
    )

@router.post("/api/pipeline/upload")
def upload(file: UploadFile = File(...)):
    # Check that the
    file_extension = file.filename.split(".")[-1].lower()
    if file_extension not in ["ifc", "ttl"]:
        raise HTTPException(status_code=400, detail="Uploaded file is not an IFC or TTL file.")

    # Check file size (read in chunks to avoid loading the entire file into memory)
    current_pos = file.file.tell()
    file.file.seek(0, 2)
    size_bytes = file.file.tell()
    file.file.seek(current_pos)
    if size_bytes > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail=f"File size exceeds the maximum allowed size of {MAX_UPLOAD_SIZE} bytes.")

    destination = TMP_DIR / Path(file.filename).name

    try:
        with destination.open("wb") as buffer:
            while contents := file.file.read(1024 * 1024):  # Read in chunks of 1MB
                buffer.write(contents)
    except Exception:
        raise HTTPException(status_code=500, detail="Something went wrong while uploading the file.")
    finally:
        file.file.close()

    return {"filename": file.filename, "size_bytes": size_bytes}

@router.get("/api/pipeline/convert/job", response_model=IfcToLbd.ConversionJob)
def get_conversion_job(job_id: str) -> IfcToLbd.ConversionJob:
    job = IfcToLbd.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Conversion job not found: {job_id}")

    return job

@router.get("/api/pipeline/convert/jobs", response_model=list[IfcToLbd.ConversionJob])
def get_all_conversion_jobs() -> list[IfcToLbd.ConversionJob]:
    return IfcToLbd.get_all_jobs()

@router.post("/api/pipeline/convert/ifc-to-ttl", response_model=str)
def convert_ifc_to_ttl(filename: str) -> str:
    # Check that the filename is valid
    if not file_utils.valid_file_name(filename, allowed_extensions=["ifc"]):
        raise HTTPException(status_code=400, detail="Invalid request! Please check the filename and try again.")

    # Only allow converting files stored in the temporary IFC folder.
    source_path = TMP_DIR / Path(filename).name
    if not source_path.exists() or not source_path.is_file():
        raise HTTPException(status_code=404, detail=f"IFC file not found: {filename}")
    
    # Check if a conversion job for this file already exists
    existing_job_id = IfcToLbd.get_job_id(source_path)
    if existing_job_id:
        return existing_job_id

    target_path = TMP_DIR / f"{source_path.stem}.ttl"
    job_id = IfcToLbd.run_conversion_in_background(source_path, target_path)

    return job_id