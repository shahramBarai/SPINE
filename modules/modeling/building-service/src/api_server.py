from __future__ import annotations

import asyncio
import os
import math
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from contextlib import asynccontextmanager
from db.sensor_connection_client import kafka_background_consumer
from deps import get_fuseki_sparql_client, FusekiSparqlError

from ttl_fuseki_manager import FusekiTTLManager

from utils.sparql_helpers import get_binding_value, get_binding_type, uri_to_id

from api import router

# --- Initialize database clients ---
FusekiClient = get_fuseki_sparql_client()

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


class SemanticSearchRequestDto(BaseModel):
	query: str
	limit: int = Field(default=300, ge=1, le=3000)
	focus_id: str | None = None


class SemanticSearchResultDto(BaseModel):
	triples: list[TripleDto]
	graph: GraphDto


def _extract_triple(binding: dict[str, Any]) -> tuple[TripleDto | None, bool]:
	for subject_key, predicate_key, object_key in (("s", "p", "o"), ("subject", "predicate", "object")):
		subject = get_binding_value(binding, subject_key)
		predicate = get_binding_value(binding, predicate_key)
		obj = get_binding_value(binding, object_key)
		if subject and predicate and obj:
			object_type = get_binding_type(binding, object_key)
			object_is_node = object_type in {"uri", "bnode"}
			return TripleDto(subject=subject, predicate=predicate, object=obj), object_is_node

	return None, False


def _build_graph_from_triples(triples: list[TripleDto], edge_enabled: list[bool], focus_id: str | None = None) -> GraphDto:
	edges_raw: list[GraphEdgeDto] = []
	nodes_by_id: dict[str, GraphNodeDto] = {}

	for triple, include_edge in zip(triples, edge_enabled):
		if not include_edge:
			continue

		from_id = uri_to_id(triple.subject)
		to_id = uri_to_id(triple.object)
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

def _short_name(uri: str) -> str:
	identifier = uri_to_id(uri)
	return identifier.replace("_", " ")


def _edge_label(predicate_uri: str) -> str:
	return uri_to_id(predicate_uri)


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

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Start the background Kafka worker safely
    consumer_task = asyncio.create_task(kafka_background_consumer())
    yield
    # Shutdown: Cancel background worker gracefully when server stops
    consumer_task.cancel()
    try:
        await consumer_task
    except asyncio.CancelledError:
        pass

app = FastAPI(title="SPINE Building Service API", version="0.1.0", lifespan=lifespan)

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

app.include_router(router)

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
		bindings = FusekiClient.select_query(query)
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
		bindings = FusekiClient.select_query(query)
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
		bindings = FusekiClient.select_query(query_text)
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
