from typing import Optional

from pydantic import BaseModel
from deps import get_fuseki_client
from fastapi import HTTPException
from utils import sparql_helpers

# --- Initialize database clients ---
FusekiClient = get_fuseki_client()

class GraphServicesSummary(BaseModel):
    type: str
    description: str
    endpoints: list[str]

class DatasetInfo(BaseModel):
    name: str
    state: bool
    services: list[GraphServicesSummary]

async def get_datasets_info() -> list[DatasetInfo]:
    """
    Retrieves a list of graph URIs from the Fuseki dataset.

    :return: A list of graph URIs available in the dataset.
    :raises httpx.HTTPStatusError: If the server returns an error status code.
    :raises httpx.RequestError: If there is a network error while making the request.
    """
    result = await FusekiClient.get_datasets()

    return [DatasetInfo(name=ds["ds.name"], state=ds["ds.state"], services=[
        GraphServicesSummary(
            type=service["srv.type"],
            description=service["srv.description"],
            endpoints=service.get("srv.endpoints", [])
        ) for service in ds.get("ds.services", [])
    ]) for ds in result]

class GraphInfoResponse(BaseModel):
    graph_uri: str
    triple_count: int

async def list_graphs(dataset_name: str) -> list[GraphInfoResponse]:
    """
    Retrieves a list of graph URIs from the Fuseki dataset.

    :param dataset_name: The name of the dataset to query.
    :return: A list of graph URIs available in the dataset with their triple counts.
    :raises httpx.HTTPStatusError: If the server returns an error status code.
    :raises httpx.RequestError: If there is a network error while making the request.
    """
    default_graph_query = """SELECT (COUNT(*) AS ?count) {?s ?p ?o}"""
    named_graphs_query = """SELECT ?g (COUNT(*) AS ?count) WHERE { GRAPH ?g { ?s ?p ?o } } GROUP BY ?g"""
    
    default_graph_result = await FusekiClient.sparql_query(dataset_name, default_graph_query)
    named_graphs_result = await FusekiClient.sparql_query(dataset_name, named_graphs_query)
    
    graphs_info = []
    graphs_info.append(GraphInfoResponse(graph_uri="default", triple_count=int(sparql_helpers.get_binding_value(default_graph_result[0], "count"))))
    for row in named_graphs_result:
        graph_uri = sparql_helpers.get_binding_value(row, "g")
        triple_count = int(sparql_helpers.get_binding_value(row, "count"))
        graphs_info.append(GraphInfoResponse(graph_uri=graph_uri, triple_count=triple_count))
    
    return graphs_info


class IfcNode(BaseModel):
    id: str
    name: str
    type: str
    children: list["IfcNode"] | None = None

def _node_type(type_uri: str) -> str:
    BOT = "https://w3id.org/bot#"
    if type_uri in {f"{BOT}Site", f"{BOT}Building"}:
        return "Project"
    if type_uri == f"{BOT}Storey":
        return "Storey"
    if type_uri == f"{BOT}Space":
        return "Space"
    return "Element"

async def get_tree(dataset_name: str) -> list[IfcNode]:
    """
    Retrieves a tree structure of nodes from the specified dataset.

    :param dataset_name: The name of the dataset to query.
    :return: A list of IfcNode objects representing the tree structure of nodes.
    :raises httpx.HTTPStatusError: If the server returns an error status code.
    :raises httpx.RequestError: If there is a network error while making the request.
    """
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
    bindings = await FusekiClient.sparql_query(dataset_name, query)
    
    nodes_raw: list[dict[str, str]] = []
    parents: dict[str, str] = {}

    for row in bindings:
        node_uri = sparql_helpers.get_binding_value(row, "node")
        node_id = sparql_helpers.uri_to_id(node_uri)
        if not node_id:
            continue
        label = sparql_helpers.get_binding_value(row, "label") or node_id
        node_type = _node_type(sparql_helpers.get_binding_value(row, "type"))
        nodes_raw.append({"id": node_id, "name": label, "type": node_type})
        parent_uri = sparql_helpers.get_binding_value(row, "parent")
        if parent_uri:
            parents[node_id] = sparql_helpers.uri_to_id(parent_uri)

    unique_nodes = {n["id"]: n for n in nodes_raw}

    by_id: dict[str, IfcNode] = {}
    for item in list(unique_nodes.values()):
        node_id = item["id"]
        by_id[node_id] = IfcNode(
            id=node_id,
            name=item["name"],
            type=item["type"],
            children=[],
        )

    roots: list[IfcNode] = []
    for node_id, node in by_id.items():
        parent_id = parents.get(node_id)
        if parent_id and parent_id in by_id and parent_id != node_id:
            by_id[parent_id].children = by_id[parent_id].children or []
            by_id[parent_id].children.append(node)
        else:
            roots.append(node)

    return roots

async def execute_sparql_query(dataset_name: str, query: str):
    """
    Executes a SPARQL query against the specified dataset.

    Note: Only supports SELECT, ASK, and CONSTRUCT queries.

    :param dataset_name: The name of the dataset to query.
    :param query: The SPARQL query string to execute.
    :return: The result of the SPARQL query execution.
    :raises httpx.HTTPStatusError: If the server returns an error status code.
    :raises httpx.RequestError: If there is a network error while making the request.
    """
    return await FusekiClient.sparql_query(dataset_name, query)


async def upload_ttl_to_fuseki(dataset_name: str, ttl_content: bytes, graph_uri: Optional[str],):
    """
    Uploads TTL content to the specified dataset and graph in Fuseki.

    :param dataset_name: The name of the dataset to upload to.
    :param ttl_content: The TTL content to upload as bytes.
    :param graph_uri: The URI of the graph to upload to. If None, the default graph is targeted.
    :return: A message indicating the result of the upload operation.
    :raises httpx.HTTPStatusError: If the server returns an error status code.
    :raises httpx.RequestError: If there is a network error while making the request.
    """
    await FusekiClient.graph_upload_ttl(dataset_name, ttl_content, graph_uri)

async def delete_graph(dataset_name: str, graph_uri: Optional[str]):
    """
    Deletes a graph from the specified dataset in Fuseki.

    :param dataset_name: The name of the dataset to delete from.
    :param graph_uri: The URI of the graph to delete. If None, the default graph is targeted.
    :return: A message indicating the result of the delete operation.
    :raises httpx.HTTPStatusError: If the server returns an error status code.
    :raises httpx.RequestError: If there is a network error while making the request.
    """
    query = f"DROP GRAPH <{graph_uri}>" if graph_uri else "DROP DEFAULT"
    await FusekiClient.sparql_update(dataset_name, query)