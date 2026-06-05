from __future__ import annotations

from fastapi import APIRouter, File, UploadFile, HTTPException
from pydantic import BaseModel
from pathlib import Path
from typing import Any

from utils import file_utils
from conversion import run_conversion

MAX_UPLOAD_SIZE = 1000 * 1024 * 1024 # 1000 MB in bytes

# TODO: Integrate file storage (MinIO) instead of using local storage.
TMP_DIR = Path("/tmp/spine_building_service")
TMP_DIR.mkdir(parents=True, exist_ok=True)


router = APIRouter(tags=["Pipelines"])

@router.post("/api/pipeline/ifc/upload")
def upload(file: UploadFile = File(...)):
	# Print file details for debugging
	
    # Check that the
    if not file.filename.split(".")[-1].lower() == "ifc":
        raise HTTPException(status_code=400, detail="Uploaded file is not an IFC file. Please upload a file with .ifc extension.")

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

class IfcLoadResponse(BaseModel):
	count: int
	files: list[str]
	
# TODO: Name this better
class IfcInputDto(BaseModel):
	file: str | None = None
	dir: str | None = None

def _collect_ifc_files(file_arg: str | None, dir_arg: str | None) -> list[Path]:
	if bool(file_arg) == bool(dir_arg):
		raise HTTPException(status_code=400, detail="Provide exactly one of 'file' or 'dir'.")

	if file_arg:
		source_path = Path(file_arg).expanduser().resolve()
		if not source_path.exists() or not source_path.is_file():
			raise HTTPException(status_code=400, detail=f"IFC file does not exist: {source_path}")
		if source_path.suffix.lower() != ".ifc":
			raise HTTPException(status_code=400, detail="Input file must have .ifc extension.")
		return [source_path]

	source_dir = Path(dir_arg or "").expanduser().resolve()
	if not source_dir.exists() or not source_dir.is_dir():
		raise HTTPException(status_code=400, detail=f"IFC directory does not exist: {source_dir}")

	ifc_files = sorted(source_dir.glob("*.ifc"))
	if not ifc_files:
		raise HTTPException(status_code=400, detail=f"No .ifc files found in: {source_dir}")

	return ifc_files

@router.post("/api/pipeline/load-ifc", response_model=IfcLoadResponse)
def load_ifc(request: IfcInputDto) -> IfcLoadResponse:
	files = _collect_ifc_files(request.file, request.dir)
	return IfcLoadResponse(count=len(files), files=[str(p) for p in files])

class PipelineFileResult(BaseModel):
	source_file: str
	target_ttl: str
	converted: bool
	uploaded: bool = False
	error: str | None = None

class PipelineConvertResponse(BaseModel):
	processed: int
	successful: int
	results: list[PipelineFileResult]
	
class PipelineRequest(BaseModel):
	file: str | None = None
	dir: str | None = None
	fuseki_graph: str | None = None
	fuseki_graph_template: str | None = None
	fuseki_replace: bool = False


def _converter_config() -> tuple[list, dict[str, Any]]:
	config_path = file_utils.get_source_root() / "config.json"
	config = file_utils.load_json(str(config_path))
	hw_config = config.get("hardware", [])
	app_config = dict(config.get("ifc2lbd", {}))

	jar_file = app_config.get("jar_file")
	if jar_file:
		jar_path = Path(jar_file)
		if not jar_path.is_absolute():
			jar_path = (file_utils.get_source_root() / jar_path).resolve()
		app_config["jar_file"] = str(jar_path)

	return hw_config, app_config

@router.post("/api/pipeline/convert", response_model=PipelineConvertResponse)
def convert_to_ttl(request: PipelineRequest) -> PipelineConvertResponse:
	files = _collect_ifc_files(request.file, request.dir)
	hw_config, app_config = _converter_config()

	results: list[PipelineFileResult] = []
	successful = 0

	for source_path in files:
		target_path = file_utils.get_target_file_path(source_path)
		converted = run_conversion(source_path, target_path, hw_config, app_config)

		if converted:
			successful += 1
			results.append(
				PipelineFileResult(
					source_file=str(source_path),
					target_ttl=str(target_path),
					converted=True,
				)
			)
		else:
			results.append(
				PipelineFileResult(
					source_file=str(source_path),
					target_ttl=str(target_path),
					converted=False,
					error="Conversion command failed.",
				)
			)

	return PipelineConvertResponse(processed=len(files), successful=successful, results=results)


# FIXME: Fix the logic!
# from encoding_utils import fix_encoding
# from ttl_fuseki_manager import FusekiError
#
# @app.post("/api/pipeline/sync", response_model=PipelineResultDto)
# def convert_and_sync(request: PipelineRequestDto) -> PipelineResultDto:
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
