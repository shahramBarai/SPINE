from __future__ import annotations

import os
import math
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from encoding_utils import fix_encoding
from fuseki_sparql_client import FusekiSparqlClient, FusekiSparqlError
from ifc_lbd_converter import get_target_file_path, load_json, run_conversion
from ttl_fuseki_manager import FusekiError, FusekiTTLManager


BOT = "https://w3id.org/bot#"


class IfcNodeDto(BaseModel):
	id: str
	name: str
	type: str
	children: list["IfcNodeDto"] | None = None


class SensorDto(BaseModel):
	id: str
	name: str
	kind: str
	status: str
	value: float
	unit: str
	bound: str


class TripleDto(BaseModel):
	subject: str
	predicate: str
	object: str


class GraphNodeDto(BaseModel):
	id: str
	label: str
	type: str
	x: float
	y: float


class GraphEdgeDto(BaseModel):
	from_id: str
	to_id: str
	label: str


class GraphDto(BaseModel):
	nodes: list[GraphNodeDto]
	edges: list[GraphEdgeDto]


class IfcInputDto(BaseModel):
	file: str | None = None
	dir: str | None = None


class IfcScanResultDto(BaseModel):
	count: int
	files: list[str]


class PipelineRequestDto(BaseModel):
	file: str | None = None
	dir: str | None = None
	fuseki_graph: str | None = None
	fuseki_graph_template: str | None = None
	fuseki_replace: bool = False


class PipelineFileResultDto(BaseModel):
	source_file: str
	target_ttl: str
	converted: bool
	uploaded: bool = False
	error: str | None = None


class PipelineResultDto(BaseModel):
	processed: int
	successful: int
	results: list[PipelineFileResultDto]


class SemanticSearchRequestDto(BaseModel):
	query: str
	limit: int = Field(default=300, ge=1, le=3000)
	focus_id: str | None = None


class SemanticSearchResultDto(BaseModel):
	triples: list[TripleDto]
	graph: GraphDto


def _v(binding: dict[str, Any], key: str, default: str = "") -> str:
	value = binding.get(key)
	if isinstance(value, dict):
		return str(value.get("value", default))
	return default


def _binding_type(binding: dict[str, Any], key: str) -> str:
	value = binding.get(key)
	if isinstance(value, dict):
		return str(value.get("type", ""))
	return ""


def _extract_triple(binding: dict[str, Any]) -> tuple[TripleDto | None, bool]:
	for subject_key, predicate_key, object_key in (("s", "p", "o"), ("subject", "predicate", "object")):
		subject = _v(binding, subject_key)
		predicate = _v(binding, predicate_key)
		obj = _v(binding, object_key)
		if subject and predicate and obj:
			object_type = _binding_type(binding, object_key)
			object_is_node = object_type in {"uri", "bnode"}
			return TripleDto(subject=subject, predicate=predicate, object=obj), object_is_node

	return None, False


def _build_graph_from_triples(triples: list[TripleDto], edge_enabled: list[bool], focus_id: str | None = None) -> GraphDto:
	edges_raw: list[GraphEdgeDto] = []
	nodes_by_id: dict[str, GraphNodeDto] = {}

	for triple, include_edge in zip(triples, edge_enabled):
		if not include_edge:
			continue

		from_id = _uri_to_id(triple.subject)
		to_id = _uri_to_id(triple.object)
		if not from_id or not to_id:
			continue

		edges_raw.append(
			GraphEdgeDto(from_id=from_id, to_id=to_id, label=_edge_label(triple.predicate))
		)

		if from_id not in nodes_by_id:
			nodes_by_id[from_id] = GraphNodeDto(
				id=from_id,
				label=_short_name(triple.subject),
				type=_graph_node_type(triple.subject),
				x=0,
				y=0,
			)
		if to_id not in nodes_by_id:
			nodes_by_id[to_id] = GraphNodeDto(
				id=to_id,
				label=_short_name(triple.object),
				type=_graph_node_type(triple.object),
				x=0,
				y=0,
			)

	if focus_id:
		edges_raw = [e for e in edges_raw if e.from_id == focus_id or e.to_id == focus_id]
		used_ids = {e.from_id for e in edges_raw} | {e.to_id for e in edges_raw}
		nodes_by_id = {node_id: node for node_id, node in nodes_by_id.items() if node_id in used_ids}

	nodes = list(nodes_by_id.values())
	total = len(nodes)
	for idx, node in enumerate(nodes):
		x, y = _layout(idx, total)
		node.x = x
		node.y = y

	return GraphDto(nodes=nodes, edges=edges_raw)


def _node_type(type_uri: str) -> str:
	if type_uri in {f"{BOT}Site", f"{BOT}Building"}:
		return "Project"
	if type_uri == f"{BOT}Storey":
		return "Storey"
	if type_uri == f"{BOT}Space":
		return "Space"
	return "Element"


def _uri_to_id(uri: str) -> str:
	if not uri:
		return ""
	if "#" in uri:
		return uri.rsplit("#", maxsplit=1)[-1]
	if "/" in uri:
		return uri.rsplit("/", maxsplit=1)[-1]
	return uri


def _kind_from_text(text: str) -> tuple[str, str]:
	lower = text.lower()
	if "co2" in lower:
		return "CO2", "ppm"
	if "humid" in lower:
		return "Humidity", "%"
	if "occup" in lower:
		return "Occupancy", "ppl"
	if "power" in lower or "watt" in lower:
		return "Power", "kW"
	return "Temp", "C"


def _short_name(uri: str) -> str:
	identifier = _uri_to_id(uri)
	return identifier.replace("_", " ")


def _edge_label(predicate_uri: str) -> str:
	return _uri_to_id(predicate_uri)


def _graph_node_type(uri: str) -> str:
	lower = uri.lower()
	if "sensor" in lower or "iot" in lower or "brick" in lower:
		return "iot"
	if "bot" in lower or "ifc" in lower or "building" in lower or "storey" in lower or "space" in lower:
		return "ifc"
	return "semantic"


def _layout(index: int, total: int) -> tuple[float, float]:
	if total <= 0:
		return 350.0, 210.0
	# Deterministic radial layout inside current SVG viewport (700x420)
	center_x, center_y = 350.0, 210.0
	radius = 140.0 + (index % 3) * 35.0
	angle = (index / total) * 6.283185307179586
	return center_x + radius * math.cos(angle), center_y + radius * math.sin(angle)


def _to_sensor(binding: dict[str, Any]) -> SensorDto:
	sensor_uri = _v(binding, "sensor")
	label = _v(binding, "label") or _uri_to_id(sensor_uri)
	observable = _v(binding, "observable")
	unit = _v(binding, "unit")
	value_raw = _v(binding, "value")
	bound_uri = _v(binding, "space")

	fallback_kind, fallback_unit = _kind_from_text(f"{label} {observable}")
	try:
		value = float(value_raw) if value_raw else 0.0
	except ValueError:
		value = 0.0

	return SensorDto(
		id=_uri_to_id(sensor_uri),
		name=label,
		kind=fallback_kind,
		status="live",
		value=value,
		unit=unit or fallback_unit,
		bound=_uri_to_id(bound_uri),
	)


def _build_tree(nodes_raw: list[dict[str, str]], parents: dict[str, str]) -> list[IfcNodeDto]:
	by_id: dict[str, IfcNodeDto] = {}
	for item in nodes_raw:
		node_id = item["id"]
		by_id[node_id] = IfcNodeDto(
			id=node_id,
			name=item["name"],
			type=item["type"],
			children=[],
		)

	roots: list[IfcNodeDto] = []
	for node_id, node in by_id.items():
		parent_id = parents.get(node_id)
		if parent_id and parent_id in by_id and parent_id != node_id:
			by_id[parent_id].children = by_id[parent_id].children or []
			by_id[parent_id].children.append(node)
		else:
			roots.append(node)

	return roots


def _client() -> FusekiSparqlClient:
	return FusekiSparqlClient(
		base_url=os.getenv("FUSEKI_BASE_URL", "http://localhost:3030"),
		dataset=os.getenv("FUSEKI_DATASET", "spine"),
	)


def _source_root() -> Path:
	return Path(__file__).resolve().parent


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


def _converter_config() -> tuple[list, dict[str, Any]]:
	config_path = _source_root() / "config.json"
	config = load_json(str(config_path))
	hw_config = config.get("hardware", [])
	app_config = dict(config.get("ifc2lbd", {}))

	jar_file = app_config.get("jar_file")
	if jar_file:
		jar_path = Path(jar_file)
		if not jar_path.is_absolute():
			jar_path = (_source_root() / jar_path).resolve()
		app_config["jar_file"] = str(jar_path)

	return hw_config, app_config


def _graph_uri(template: str | None, target_file: Path) -> str | None:
	if not template:
		return None
	return template.format(stem=target_file.stem, name=target_file.name)


def _fuseki_manager() -> FusekiTTLManager:
	return FusekiTTLManager(
		base_url=os.getenv("FUSEKI_BASE_URL", "http://localhost:3030"),
		dataset=os.getenv("FUSEKI_DATASET", "spine"),
		username=os.getenv("FUSEKI_USERNAME", "admin"),
		password=os.getenv("FUSEKI_PASSWORD", "admin123"),
		timeout_seconds=float(os.getenv("FUSEKI_TIMEOUT_SECONDS", "600")),
	)


app = FastAPI(title="SPINE Building Service API", version="0.1.0")

frontend_origin_env = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
frontend_origins = [o.strip() for o in frontend_origin_env.split(",") if o.strip()]
if not frontend_origins:
	frontend_origins = ["http://localhost:5173"]

default_dev_origins = [
	"http://localhost:5173",
	"http://127.0.0.1:5173",
	"http://localhost:8080",
	"http://127.0.0.1:8080",
]

allow_origins = list(dict.fromkeys([*frontend_origins, *default_dev_origins]))

app.add_middleware(
	CORSMiddleware,
	allow_origins=allow_origins,
	allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?$",
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
	return {"status": "ok"}


@app.post("/api/pipeline/load-ifc", response_model=IfcScanResultDto)
def load_ifc(request: IfcInputDto) -> IfcScanResultDto:
	files = _collect_ifc_files(request.file, request.dir)
	return IfcScanResultDto(count=len(files), files=[str(p) for p in files])


@app.post("/api/pipeline/convert", response_model=PipelineResultDto)
def convert_to_ttl(request: PipelineRequestDto) -> PipelineResultDto:
	files = _collect_ifc_files(request.file, request.dir)
	hw_config, app_config = _converter_config()

	results: list[PipelineFileResultDto] = []
	successful = 0

	for source_path in files:
		target_path = get_target_file_path(source_path)
		converted = run_conversion(source_path, target_path, hw_config, app_config)

		if converted:
			successful += 1
			results.append(
				PipelineFileResultDto(
					source_file=str(source_path),
					target_ttl=str(target_path),
					converted=True,
				)
			)
		else:
			results.append(
				PipelineFileResultDto(
					source_file=str(source_path),
					target_ttl=str(target_path),
					converted=False,
					error="Conversion command failed.",
				)
			)

	return PipelineResultDto(processed=len(files), successful=successful, results=results)


@app.post("/api/pipeline/sync", response_model=PipelineResultDto)
def convert_and_sync(request: PipelineRequestDto) -> PipelineResultDto:
	if request.fuseki_graph and request.fuseki_graph_template:
		raise HTTPException(status_code=400, detail="Use either fuseki_graph or fuseki_graph_template, not both.")

	files = _collect_ifc_files(request.file, request.dir)
	hw_config, app_config = _converter_config()
	manager = _fuseki_manager()

	results: list[PipelineFileResultDto] = []
	successful = 0

	for source_path in files:
		target_path = get_target_file_path(source_path)
		converted = run_conversion(source_path, target_path, hw_config, app_config)
		if not converted:
			results.append(
				PipelineFileResultDto(
					source_file=str(source_path),
					target_ttl=str(target_path),
					converted=False,
					error="Conversion command failed.",
				)
			)
			continue

		try:
			fix_encoding(str(target_path))
			graph_uri = _graph_uri(request.fuseki_graph_template, target_path) or request.fuseki_graph
			manager.load_ttl_file(
				ttl_path=str(target_path),
				graph_uri=graph_uri,
				replace=request.fuseki_replace,
			)
			successful += 1
			results.append(
				PipelineFileResultDto(
					source_file=str(source_path),
					target_ttl=str(target_path),
					converted=True,
					uploaded=True,
				)
			)
		except (FusekiError, OSError) as exc:
			results.append(
				PipelineFileResultDto(
					source_file=str(source_path),
					target_ttl=str(target_path),
					converted=True,
					uploaded=False,
					error=str(exc),
				)
			)

	return PipelineResultDto(processed=len(files), successful=successful, results=results)


@app.get("/api/tree", response_model=list[IfcNodeDto])
def get_tree() -> list[IfcNodeDto]:
	query = """
	PREFIX bot: <https://w3id.org/bot#>
	PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

	SELECT ?node ?label ?type ?parent
	WHERE {
	  ?node a ?type .
	  FILTER (?type IN (bot:Site, bot:Building, bot:Storey, bot:Space))
	  OPTIONAL { ?node rdfs:label ?label }
	  OPTIONAL {
		?parent (bot:hasBuilding | bot:hasStorey | bot:hasSpace | bot:containsZone) ?node .
	  }
	}
	"""
	try:
		bindings = _client().select_query(query)
	except FusekiSparqlError as exc:
		raise HTTPException(status_code=502, detail=str(exc)) from exc

	nodes_raw: list[dict[str, str]] = []
	parents: dict[str, str] = {}

	for row in bindings:
		node_uri = _v(row, "node")
		node_id = _uri_to_id(node_uri)
		if not node_id:
			continue
		label = _v(row, "label") or node_id
		node_type = _node_type(_v(row, "type"))
		nodes_raw.append({"id": node_id, "name": label, "type": node_type})
		parent_uri = _v(row, "parent")
		if parent_uri:
			parents[node_id] = _uri_to_id(parent_uri)

	unique_nodes = {n["id"]: n for n in nodes_raw}
	return _build_tree(list(unique_nodes.values()), parents)


@app.get("/api/sensors", response_model=list[SensorDto])
def get_sensors() -> list[SensorDto]:
	query = """
	PREFIX brick: <https://brickschema.org/schema/Brick#>
	PREFIX s223: <http://data.ashrae.org/standard223#>
	PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
	PREFIX saref: <https://saref.etsi.org/core/>

	SELECT ?sensor ?label ?observable ?unit ?value ?space
	WHERE {
	  ?sensor a brick:Sensor .
	  OPTIONAL { ?sensor rdfs:label ?label }
	  OPTIONAL { ?sensor brick:measures ?observable }
	  OPTIONAL { ?sensor <http://qudt.org/schema/qudt/hasUnit> ?unit }
	  OPTIONAL { ?sensor saref:hasValue ?value }
	  OPTIONAL { ?sensor s223:isLocatedIn ?space }
	}
	ORDER BY ?label
	"""
	try:
		bindings = _client().select_query(query)
	except FusekiSparqlError as exc:
		raise HTTPException(status_code=502, detail=str(exc)) from exc

	return [_to_sensor(row) for row in bindings]


@app.get("/api/triples", response_model=list[TripleDto])
def get_triples(limit: int = Query(default=200, ge=1, le=2000)) -> list[TripleDto]:
	query = f"""
	SELECT ?s ?p ?o
	WHERE {{
	  ?s ?p ?o .
	}}
	LIMIT {limit}
	"""
	try:
		bindings = _client().select_query(query)
	except FusekiSparqlError as exc:
		raise HTTPException(status_code=502, detail=str(exc)) from exc

	triples: list[TripleDto] = []
	for row in bindings:
		triple, _ = _extract_triple(row)
		if triple:
			triples.append(triple)

	return triples


@app.get("/api/graph", response_model=GraphDto)
def get_graph(
	focus_id: str | None = Query(default=None),
	limit: int = Query(default=300, ge=20, le=3000),
) -> GraphDto:
	query = f"""
	SELECT ?s ?p ?o
	WHERE {{
	  ?s ?p ?o .
	  FILTER(isIRI(?s) && isIRI(?o))
	}}
	LIMIT {limit}
	"""

	try:
		bindings = _client().select_query(query)
	except FusekiSparqlError as exc:
		raise HTTPException(status_code=502, detail=str(exc)) from exc

	triples: list[TripleDto] = []
	edge_enabled: list[bool] = []
	for row in bindings:
		triple, object_is_node = _extract_triple(row)
		if triple:
			triples.append(triple)
			edge_enabled.append(object_is_node)

	return _build_graph_from_triples(triples, edge_enabled, focus_id=focus_id)


@app.post("/api/semantic-search", response_model=SemanticSearchResultDto)
def semantic_search(request: SemanticSearchRequestDto) -> SemanticSearchResultDto:
	query_text = request.query.strip()
	if not query_text:
		raise HTTPException(status_code=400, detail="SPARQL query is required.")

	lower_query = query_text.lower()
	if "select" not in lower_query:
		raise HTTPException(
			status_code=400,
			detail="Only SPARQL SELECT queries are supported for semantic search.",
		)

	try:
		bindings = _client().select_query(query_text)
	except FusekiSparqlError as exc:
		raise HTTPException(status_code=502, detail=str(exc)) from exc

	triples: list[TripleDto] = []
	edge_enabled: list[bool] = []
	for row in bindings:
		triple, object_is_node = _extract_triple(row)
		if not triple:
			continue
		triples.append(triple)
		edge_enabled.append(object_is_node)
		if len(triples) >= request.limit:
			break

	if not triples:
		raise HTTPException(
			status_code=400,
			detail="Query must return variables (?s ?p ?o) or (?subject ?predicate ?object).",
		)

	graph = _build_graph_from_triples(triples, edge_enabled, focus_id=request.focus_id)
	return SemanticSearchResultDto(triples=triples, graph=graph)

class FusekiStatusDto(BaseModel):
	connected: bool
	url: str


@app.get("/api/fuseki/status", response_model=FusekiStatusDto)
def fuseki_status() -> FusekiStatusDto:
	manager = _fuseki_manager()
	return FusekiStatusDto(
		connected=manager.ping(),
		url=f"{manager.base_url}/{manager.dataset}",
	)


@app.post("/api/fuseki/connect", response_model=FusekiStatusDto)
def fuseki_connect() -> FusekiStatusDto:
	manager = _fuseki_manager()
	connected = manager.ping()
	if not connected:
		raise HTTPException(
			status_code=503,
			detail=f"Cannot reach Fuseki dataset at {manager.base_url}/{manager.dataset}. "
			       "Ensure Fuseki is running and the dataset exists.",
		)
	return FusekiStatusDto(connected=True, url=f"{manager.base_url}/{manager.dataset}")

