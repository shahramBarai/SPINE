from __future__ import annotations

from fastapi import APIRouter, File, UploadFile, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
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

@router.post("/api/pipeline/convert/ifc-to-ttl")
def convert_ifc_to_ttl(filename: str):
    # Check that the filename is valid
    if not file_utils.valid_file_name(filename, allowed_extensions=["ifc"]):
        raise HTTPException(status_code=400, detail="Invalid request! Please check the filename and try again.")

    # Only allow converting files stored in the temporary IFC folder.
    source_path = TMP_DIR / Path(filename).name
    if not source_path.exists() or not source_path.is_file():
        raise HTTPException(status_code=404, detail=f"IFC file not found: {filename}")

    target_path = TMP_DIR / f"{source_path.stem}.ttl"
    converted = IfcToLbd.run_conversion(source_path, target_path)

    if not converted:
        raise HTTPException(status_code=500, detail="Conversion failed for the provided IFC file.")

    return {"source_file": str(source_path), "target_ttl": str(target_path)}

@router.post("/api/pipeline/convert/ifc-to-ttl/background")
def convert_ifc_to_ttl_background(filename: str) -> str:
    # Check that the filename is valid
    if not file_utils.valid_file_name(filename, allowed_extensions=["ifc"]):
        raise HTTPException(status_code=400, detail="Invalid request! Please check the filename and try again.")

    source_path = TMP_DIR / Path(filename).name
    if not source_path.exists() or not source_path.is_file():
        raise HTTPException(status_code=404, detail=f"IFC file not found: {filename}")

    target_path = TMP_DIR / f"{source_path.stem}.ttl"
    job_id = IfcToLbd.run_conversion_in_background(source_path, target_path)

    return job_id

class ConversionJobResponse(BaseModel):
    job_id: str
    status: str
    source_file: str
    target_ttl: str
    error: str | None = None
    created_at: str
    updated_at: str

@router.get("/api/pipeline/convert/jobs/{job_id}", response_model=ConversionJobResponse)
def get_conversion_job(job_id: str) -> ConversionJobResponse:
    job = IfcToLbd.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Conversion job not found: {job_id}")

    return ConversionJobResponse(**job)

@router.get("/api/pipeline/convert/jobs", response_model=list[ConversionJobResponse])
def get_all_conversion_jobs() -> list[ConversionJobResponse]:
    jobs = IfcToLbd.get_all_jobs()
    return [ConversionJobResponse(**job) for job in jobs]

@router.post("/api/pipeline/sync-to-fuseki")
def sync_to_fuseki(filename: str, replace: bool = False):
    # Check that the filename is valid
    if not file_utils.valid_file_name(filename, allowed_extensions=["ttl"]):
        raise HTTPException(status_code=400, detail="Invalid request! Please check the filename and try again.")

    # Only allow syncing files stored in the temporary TTL folder.
    ttl_path = TMP_DIR / Path(filename).name
    if not ttl_path.exists() or not ttl_path.is_file():
        raise HTTPException(status_code=404, detail=f"TTL file not found: {filename}")
    
    #TODO: Implement the actual syncing logic using the Fuseki manager and handle errors accordingly.
    # For now, just return a success message for testing purposes.

    return {"message": f"Successfully synced {filename} to Fuseki (replace={replace})."}

# FIXME: Fix the logic!
# from encoding_utils import fix_encoding
# from ttl_fuseki_manager import FusekiError
#
# @app.post("/api/pipeline/sync", response_model=PipelineResultDto)
# def convert_and_sync(request: PipelineRequest) -> PipelineResultDto:
# 	if request.fuseki_graph and request.fuseki_graph_template:
# 		raise HTTPException(status_code=400, detail="Use either fuseki_graph or fuseki_graph_template, not both.")

# 	files = _collect_ifc_files(request.file, request.dir)
# 	hw_config, app_config = _converter_config()
# 	manager = _fuseki_manager()

# 	results: list[PipelineFileResultDto] = []
# 	successful = 0

# 	for source_path in files:
# 		target_path = get_target_file_path(source_path)
# 		converted = run_conversion(source_path, target_path, hw_config, app_config)
# 		if not converted:
# 			results.append(
# 				PipelineFileResultDto(
# 					source_file=str(source_path),
# 					target_ttl=str(target_path),
# 					converted=False,
# 					error="Conversion command failed.",
# 				)
# 			)
# 			continue

# 		try:
# 			fix_encoding(str(target_path))
# 			graph_uri = _graph_uri(request.fuseki_graph_template, target_path) or request.fuseki_graph
# 			manager.load_ttl_file(
# 				ttl_path=str(target_path),
# 				graph_uri=graph_uri,
# 				replace=request.fuseki_replace,
# 			)
# 			successful += 1
# 			results.append(
# 				PipelineFileResultDto(
# 					source_file=str(source_path),
# 					target_ttl=str(target_path),
# 					converted=True,
# 					uploaded=True,
# 				)
# 			)
# 		except (FusekiError, OSError) as exc:
# 			results.append(
# 				PipelineFileResultDto(
# 					source_file=str(source_path),
# 					target_ttl=str(target_path),
# 					converted=True,
# 					uploaded=False,
# 					error=str(exc),
# 				)
# 			)

# 	return PipelineResultDto(processed=len(files), successful=successful, results=results)
