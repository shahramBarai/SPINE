from __future__ import annotations

from fastapi import APIRouter, File, UploadFile, HTTPException
from fastapi.responses import FileResponse
import httpx
from pydantic import BaseModel
from pathlib import Path
from typing import Optional

from utils import file_utils
from conversion import IfcToLbd
from services import DatasetService

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
    
@router.post("/api/pipeline/sync-to-fuseki")
async def sync_to_fuseki(filename: str, dataset_name: str, graph_uri: Optional[str] = None, replace: bool = False):
    # Check that the filename is valid
    if not file_utils.valid_file_name(filename, allowed_extensions=["ttl"]):
        raise HTTPException(status_code=400, detail="Invalid request! Please check the filename and try again.")

    # Only allow syncing files stored in the temporary TTL folder.
    ttl_path = TMP_DIR / Path(filename).name
    if not ttl_path.exists() or not ttl_path.is_file():
        raise HTTPException(status_code=404, detail=f"TTL file not found: {filename}")
    
    error_message = None

    try:
        # 1. Validate that the graph exists
        graphs = await DatasetService.list_graphs(dataset_name)
        target_graph = graph_uri or "default"
        existing_graph: DatasetService.GraphInfoResponse | None = None
        for g in graphs:
            if g.graph_uri == target_graph:
                existing_graph = g
                break
        # 2. If the graph exists, not empty, and replace is False, return an error to avoid accidental data loss
        # 2.1 If the graph exists and replace is True, proceed to delete the existing graph before uploading the new data
        if existing_graph and existing_graph.triple_count > 0 and not replace:
            raise HTTPException(status_code=400, detail=f"Graph '{target_graph}' already exists in dataset '{dataset_name}'. Use replace=true to overwrite it.")
        elif existing_graph and replace:
            await DatasetService.delete_graph(dataset_name, graph_uri)
        # 3. Upload the new TTL data to Fuseki after validation 
        # (graph with the same name should not exist at this point or should be empty)
        data = open(ttl_path, "rb").read()
        await DatasetService.upload_ttl_to_fuseki(dataset_name=dataset_name, ttl_content=data, graph_uri=graph_uri)
        #TODO: Add data backup and restore mechanism in case the upload fails after deletion of the existing graph, to avoid data loss.
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail=str(exc)) from exc
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail="Network error while connecting to Fuseki") from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Failed to sync TTL file to Fuseki") from exc

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
