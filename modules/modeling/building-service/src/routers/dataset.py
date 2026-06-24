import httpx

from fastapi import APIRouter, HTTPException, Query
from services import DatasetService, BuildingGraphService, SemanticSearchService
from typing import Optional
from pydantic import BaseModel, Field

from utils import sparql_helpers

router = APIRouter(prefix="/api", tags=["Dataset Operations"])

@router.get("/datasets", response_model=list[DatasetService.DatasetInfo])
async def get_dataset_info() -> list[DatasetService.DatasetInfo]:
    """
    Endpoint to list all datasets within the Fuseki server along with their state and available services.

    **Returns**:
        A list of dataset information.
    """
    try:
        return await DatasetService.read_datasets()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail=str(exc)) from exc
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail="Network error while connecting to Fuseki") from exc
    except Exception:
        raise HTTPException(status_code=502, detail="Failed to retrieve datasets from Fuseki")
    
@router.get("/dataset/{dataset_name}/graphs")
async def list_graphs(dataset_name: str) -> list[DatasetService.GraphInfoResponse]:
    """
    Endpoint to list all graph URIs within a specified dataset.

    **Arguments**:
        dataset_name: The name of the dataset to query.
    **Returns**:
        A list of graph information available in the dataset.
    """
    try:
        return await DatasetService.read_list_graphs(dataset_name)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail=str(exc)) from exc
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail="Network error while connecting to Fuseki") from exc
    except Exception:
        raise HTTPException(status_code=502, detail="Failed to retrieve graph data from Fuseki")

@router.get("/dataset/{dataset_name}/tree", response_model=list[BuildingGraphService.IfcNode])
async def get_graph_tree(dataset_name: str) -> list[BuildingGraphService.IfcNode]:
    """
    Endpoint to retrieve a tree structure of nodes from the specified dataset.

    **Arguments**:
        dataset_name: The name of the dataset to query.
    **Returns**:
        A tree structure of nodes.
    """
    try:
        return await BuildingGraphService.get_tree(dataset_name)
    except Exception as exc:
        print(f"Error retrieving graph tree: {exc}")
        raise HTTPException(status_code=502, detail="Failed to retrieve graph tree from Fuseki") from exc

@router.post("/dataset/{dataset_name}/sparql")
async def execute_sparql_query(dataset_name: str, query: str):
    """
    Endpoint to execute a SPARQL query against the specified dataset.

    Note: Only supports SELECT, ASK, and CONSTRUCT queries.

    **Arguments**:
        dataset_name: The name of the dataset to query.
        query: The SPARQL query string to execute.
    **Returns**:
        The results of the SPARQL query.
    """
    # FIXME: Add more robust query type validation (e.g., using a SPARQL parser library) 
    # to prevent injection and ensure only allowed query types are executed.
    lower_query = query.lower()
    if not any(q in lower_query for q in ("select", "ask", "construct")):
        raise HTTPException(
            status_code=400,
            detail="Only SPARQL SELECT, ASK, and CONSTRUCT queries are supported.",
        )

    try:
        return await SemanticSearchService.execute_sparql_query(dataset_name, query)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail=str(exc)) from exc
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail="Network error while connecting to Fuseki") from exc
    except Exception:
        raise HTTPException(status_code=502, detail="Failed to execute SPARQL query on Fuseki")

class SemanticSearchRequest(BaseModel):
	query: str
	limit: int = Field(default=300, ge=1, le=3000)
	focus_id: str | None = None

class SemanticSearchResult(BaseModel):
	triples: list[sparql_helpers.TripleDto]
	graph: sparql_helpers.GraphDto

@router.post("/dataset/{dataset_name}/semantic-search", response_model=SemanticSearchResult)
def semantic_search(dataset_name: str, request: SemanticSearchRequest) -> SemanticSearchResult:
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
        bindings = SemanticSearchService.execute_sparql_query(dataset_name, query_text)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail=str(exc)) from exc
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail="Network error while connecting to Fuseki")
    except Exception:
        raise HTTPException(status_code=502, detail="Failed to execute SPARQL query on Fuseki")

    triples: list[sparql_helpers.TripleDto] = []
    edge_enabled: list[bool] = []
    for row in bindings:
        triple, object_is_node = sparql_helpers.extract_triple(row)
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

    graph = sparql_helpers.build_graph_from_triples(triples, edge_enabled, focus_id=request.focus_id)
    return SemanticSearchResult(triples=triples, graph=graph)

@router.delete("/dataset/{dataset_name}/graph")
async def delete_graph(dataset_name: str, graph_uri: Optional[str] = None):
    """
    Endpoint to delete a graph from the specified dataset.

    **Arguments**:
        dataset_name: The name of the dataset to delete from.
        graph_uri: The URI of the graph to delete. If None, the default graph is targeted.
    **Returns**:
        A message indicating the result of the delete operation.
    """
    try:
        # 1. Validate that the graph exists before attempting deletion
        graphs = await DatasetService.read_list_graphs(dataset_name)
        target_graph = graph_uri or "default"
        # 2. Proceed to delete the graph only if it exists
        if target_graph in [g.graph_uri for g in graphs]:
            await DatasetService.delete_graph(dataset_name, graph_uri)
        # 3. Return a success message regardless of whether the graph existed or not, 
        # to avoid information leakage about graph existence
        return {"message": "Graph deleted successfully"}
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail=str(exc)) from exc
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail="Network error while connecting to Fuseki") from exc
    except Exception:
        raise HTTPException(status_code=502, detail="Failed to delete graph from Fuseki") from exc

@router.get("/api/graph", response_model=sparql_helpers.GraphDto)
async def get_graph(
    focus_id: str | None = Query(default=None),
    limit: int = Query(default=300, ge=20, le=3000),
) -> sparql_helpers.GraphDto:
    """
    Endpoint to retrieve a graph structure based on triples from the dataset.
    **Arguments**:
    focus_id: Optional ID to focus the graph on (only include edges connected to this node)
    limit: Maximum number of triples to include in the graph (default 300, max 3000)
    **Returns**:
    A GraphDto containing nodes and edges for visualization.
    """
    query = f"""
    SELECT ?s ?p ?o
    WHERE {{
        ?s ?p ?o .
        FILTER(isIRI(?s) && isIRI(?o))
    }}
    LIMIT {limit}
    """

    try:
        bindings = await SemanticSearchService.execute_sparql_query("spine", query)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail=str(exc)) from exc
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail="Network error while connecting to Fuseki") from exc
    except Exception:
        raise HTTPException(status_code=502, detail="Failed to execute SPARQL query on Fuseki") from exc
        

    triples: list[sparql_helpers.TripleDto] = []
    edge_enabled: list[bool] = []
    for row in bindings:
        triple, object_is_node = sparql_helpers.extract_triple(row)
        if triple:
            triples.append(triple)
            edge_enabled.append(object_is_node)

    return sparql_helpers.build_graph_from_triples(triples, edge_enabled, focus_id=focus_id)

@router.get("/api/triples", response_model=list[sparql_helpers.TripleDto])
async def get_triples(limit: int = Query(default=200, ge=1, le=2000)) -> list[sparql_helpers.TripleDto]:
    query = f"""
    SELECT ?s ?p ?o
    WHERE {{
        ?s ?p ?o .
    }}
    LIMIT {limit}
    """
    try:
        bindings = await SemanticSearchService.execute_sparql_query("spine", query)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail=str(exc)) from exc
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail="Network error while connecting to Fuseki") from exc
    except Exception:
        raise HTTPException(status_code=502, detail="Failed to execute SPARQL query on Fuseki") from exc

    triples: list[sparql_helpers.TripleDto] = []
    for row in bindings:
        triple, _ = sparql_helpers.extract_triple(row)
        if triple:
            triples.append(triple)

    return triples