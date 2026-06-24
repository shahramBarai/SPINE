from typing import Optional

from pydantic import BaseModel
from deps import get_fuseki_client
from utils import sparql_helpers

# --- Initialize database clients ---
FusekiClient = get_fuseki_client()

# ---- Data Models ----
class GraphServicesSummary(BaseModel):
    type: str
    description: str
    endpoints: list[str]

class DatasetInfo(BaseModel):
    name: str
    state: bool
    services: list[GraphServicesSummary]

class GraphInfoResponse(BaseModel):
    graph_uri: str
    triple_count: int

# ---- Service Functions (use CRUD style naming) ----

async def read_datasets() -> list[DatasetInfo]:
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

async def read_list_graphs(dataset_name: str) -> list[GraphInfoResponse]:
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