"""
name: building_graph.py
description: This module provides services for interacting with building-related graph data in a Fuseki dataset.
It includes functions to retrieve building structures, spaces, systems, sensors, and other related entities.
The services are designed to work with the Apache Jena Fuseki SPARQL endpoint and provide

NOTE: This functions was moved from fuseki_sparql_client.py to remove domain-specific logic from the client and keep it focused on SPARQL execution.

TODO: Test and validate the functions in this module to ensure they work correctly with the Fuseki dataset.
"""


from typing import Optional, Dict

from pydantic import BaseModel
from utils import sparql_helpers
from deps import get_fuseki_client

# --- Initialize database clients ---
FusekiClient = get_fuseki_client()

# --- Data Models ---
class IfcNode(BaseModel):
    id: str
    name: str
    type: str
    children: list["IfcNode"] | None = None

# --- Helper Functions ---
def _node_type(type_uri: str) -> str:
    BOT = "https://w3id.org/bot#"
    if type_uri in {f"{BOT}Site", f"{BOT}Building"}:
        return "Project"
    if type_uri == f"{BOT}Storey":
        return "Storey"
    if type_uri == f"{BOT}Space":
        return "Space"
    return "Element"

# --- Service Functions (use CRUD style naming) ---
async def get_tree(dataset_name: str) -> list[IfcNode]:
    """
    Retrieves a tree structure of nodes from the specified dataset.

    Parameters:
        dataset_name: The name of the dataset to query.
    Returns:
        A list of IfcNode objects representing the tree structure of nodes.
    Raises:
        httpx.HTTPStatusError: If the server returns an error status code.
        httpx.RequestError: If there is a network error while making the request.
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

async def get_buildings(dataset_name: str, graph_uri: Optional[str] = None) -> list[Dict[str, str]]:
        """
        Retrieve all BOT buildings in the dataset.

        Parameters:
            dataset_name: The name of the dataset to query.
            graph_uri: Optional named graph to restrict query to.
        Returns:
            List of dicts with 'building' and 'label' keys.
        Raises:
            httpx.HTTPStatusError: If the server returns an error status code.
            httpx.RequestError: If there is a network error while making the request.
        """
        graph_clause = f"GRAPH <{graph_uri}> {{\n    " if graph_uri else ""
        graph_end = "\n  }" if graph_uri else ""

        query = f"""
        PREFIX bot: <https://w3id.org/bot#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

        SELECT ?building ?label
        WHERE {{
          {graph_clause}?building a bot:Building .
          OPTIONAL {{ ?building rdfs:label ?label }}
          {graph_end}
        }}
        ORDER BY ?label
        """
        bindings = await FusekiClient.sparql_query(dataset_name, query)
        return bindings

async def get_spaces(dataset_name: str, building_uri: Optional[str] = None, graph_uri: Optional[str] = None) -> list[Dict[str, str]]:
        """
        Retrieve all BOT spaces, optionally within a building.

        Parameters:
            dataset_name: The name of the dataset to query.
            building_uri: Optional building URI to filter by.
            graph_uri: Optional named graph to restrict query to.
        Returns:
            List of dicts with 'space', 'label', and 'type' keys.
        Raises:
            httpx.HTTPStatusError: If the server returns an error status code.
            httpx.RequestError: If there is a network error while making the request.
        """
        graph_clause = f"GRAPH <{graph_uri}> {{\n    " if graph_uri else ""
        graph_end = "\n  }" if graph_uri else ""
        building_clause = f"?space bot:isContainedIn <{building_uri}> .\n  " if building_uri else ""

        query = f"""
        PREFIX bot: <https://w3id.org/bot#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

        SELECT ?space ?label ?type
        WHERE {{
          {graph_clause}{building_clause}?space rdf:type ?type .
          FILTER (?type IN (bot:Space, bot:Storey, bot:Building))
          OPTIONAL {{ ?space rdfs:label ?label }}
          {graph_end}
        }}
        ORDER BY ?type ?label
        """
        return await FusekiClient.sparql_query(dataset_name, query)

async def get_space_adjacencies(dataset_name: str, space_uri: str, graph_uri: Optional[str] = None) -> list[dict[str, str]]:
    """
    Retrieve adjacent spaces (space-to-space relationships).

    Parameters:
        dataset_name: The name of the dataset to query.
        space_uri: URI of the space to find adjacencies for.
        graph_uri: Optional named graph to restrict query to.
    Returns:
        List of dicts with 'adjacent_space' and 'adjacent_label' keys.
    Raises:
        httpx.HTTPStatusError: If the server returns an error status code.
        httpx.RequestError: If there is a network error while making the request.
    """
    graph_clause = f"GRAPH <{graph_uri}> {{\n    " if graph_uri else ""
    graph_end = "\n  }" if graph_uri else ""

    query = f"""
    PREFIX bot: <https://w3id.org/bot#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

    SELECT ?adjacent_space ?adjacent_label
    WHERE {{
        {graph_clause}<{space_uri}> bot:adjacentZone ?adjacent_space .
        OPTIONAL {{ ?adjacent_space rdfs:label ?adjacent_label }}
        {graph_end}
    }}
    ORDER BY ?adjacent_label
    """
    return await FusekiClient.sparql_query(dataset_name, query)

async def get_systems(dataset_name: str, building_uri: Optional[str] = None, graph_uri: Optional[str] = None) -> list[dict[str, str]]:
    """
    Retrieve all systems (HVAC, electrical, etc.) in a building.

    Parameters:
        dataset_name: The name of the dataset to query.
        building_uri: Optional building URI to filter by.
        graph_uri: Optional named graph to restrict query to.
    Returns:
        List of dicts with 'system', 'label', and 'type' keys.
    Raises:
        httpx.HTTPStatusError: If the server returns an error status code.
        httpx.RequestError: If there is a network error while making the request.
    """
    graph_clause = f"GRAPH <{graph_uri}> {{\n    " if graph_uri else ""
    graph_end = "\n  }" if graph_uri else ""
    building_clause = f"?system s223:isLocatedIn <{building_uri}> .\n  " if building_uri else ""

    query = f"""
    PREFIX s223: <http://data.ashrae.org/standard223#>
    PREFIX brick: <https://brickschema.org/schema/Brick#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

    SELECT ?system ?label ?type
    WHERE {{
        {graph_clause}{building_clause}?system rdf:type ?type .
        FILTER (?type IN (brick:System, s223:PhysicalSpace, brick:Equipment))
        OPTIONAL {{ ?system rdfs:label ?label }}
        {graph_end}
    }}
    ORDER BY ?type ?label
    """
    return await FusekiClient.sparql_query(dataset_name, query)

async def get_system_components(dataset_name: str, system_uri: str, graph_uri: Optional[str] = None) -> list[dict[str, str]]:
    """
    Retrieve components (terminals, controllers, devices) in a system.

    Parameters:
        dataset_name: The name of the dataset to query.
        system_uri: URI of the system.
        graph_uri: Optional named graph to restrict query to.
    Returns:
        List of dicts with 'component', 'label', and 'type' keys.
    Raises:
        httpx.HTTPStatusError: If the server returns an error status code.
        httpx.RequestError: If there is a network error while making the request.
    """
    graph_clause = f"GRAPH <{graph_uri}> {{\n    " if graph_uri else ""
    graph_end = "\n  }" if graph_uri else ""

    query = f"""
    PREFIX s223: <http://data.ashrae.org/standard223#>
    PREFIX brick: <https://brickschema.org/schema/Brick#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

    SELECT ?component ?label ?type
    WHERE {{
        {graph_clause}<{system_uri}> (s223:hasPart | s223:includes)* ?component .
        ?component rdf:type ?type .
        OPTIONAL {{ ?component rdfs:label ?label }}
        {graph_end}
    }}
    ORDER BY ?type ?label
    """
    return await FusekiClient.sparql_query(dataset_name, query)

async def get_sensors(dataset_name: str, space_uri: Optional[str] = None, graph_uri: Optional[str] = None) -> list[dict[str, str]]:
    """
    Retrieve sensor instances, optionally within a space.

    Parameters:
        dataset_name: The name of the dataset to query.
        space_uri: Optional space URI to filter sensors by location.
        graph_uri: Optional named graph to restrict query to.
    Returns:
        List of dicts with 'sensor', 'label', 'observable', and 'unit' keys.
    Raises:
        httpx.HTTPStatusError: If the server returns an error status code.
        httpx.RequestError: If there is a network error while making the request.
    """
    graph_clause = f"GRAPH <{graph_uri}> {{\n    " if graph_uri else ""
    graph_end = "\n  }" if graph_uri else ""
    space_clause = f"?sensor s223:isLocatedIn <{space_uri}> .\n  " if space_uri else ""

    query = f"""
    PREFIX s223: <http://data.ashrae.org/standard223#>
    PREFIX brick: <https://brickschema.org/schema/Brick#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

    SELECT ?sensor ?label ?observable ?unit
    WHERE {{
        {graph_clause}{space_clause}?sensor rdf:type brick:Sensor .
        OPTIONAL {{ ?sensor rdfs:label ?label }}
        OPTIONAL {{ ?sensor brick:measures ?observable }}
        OPTIONAL {{ ?sensor qudt:hasUnit ?unit }}
        {graph_end}
    }}
    ORDER BY ?label
    """
    return await FusekiClient.sparql_query(dataset_name, query)

async def get_space_points(dataset_name: str, space_uri: str, graph_uri: Optional[str] = None) -> list[dict[str, str]]:
    """
    Retrieve all points (sensors, setpoints, etc.) associated with a space.

    Parameters:
        dataset_name: The name of the dataset to query.
        space_uri: URI of the space.
        graph_uri: Optional named graph to restrict query to.
    Returns:
        List of dicts with 'point', 'label', and 'type' keys.
    Raises:
        httpx.HTTPStatusError: If the server returns an error status code.
        httpx.RequestError: If there is a network error while making the request.
    """
    graph_clause = f"GRAPH <{graph_uri}> {{\n    " if graph_uri else ""
    graph_end = "\n  }" if graph_uri else ""

    query = f"""
    PREFIX brick: <https://brickschema.org/schema/Brick#>
    PREFIX s223: <http://data.ashrae.org/standard223#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

    SELECT ?point ?label ?type
    WHERE {{
        {graph_clause}?point (s223:isLocatedIn | brick:isLocatedIn)* <{space_uri}> .
        ?point rdf:type ?type .
        FILTER (?type IN (brick:Sensor, brick:Setpoint, brick:Parameter, s223:StateVariable))
        OPTIONAL {{ ?point rdfs:label ?label }}
        {graph_end}
    }}
    ORDER BY ?type ?label
    """
    return await FusekiClient.sparql_query(dataset_name, query)

async def count_entities(dataset_name: str, entity_type: str, graph_uri: Optional[str] = None) -> int:
    """
    Count entities of a specific RDF type.

    Parameters:
        dataset_name: The name of the dataset to query.
        entity_type: Full URI of the entity type (e.g., "https://w3id.org/bot#Space").
        graph_uri: Optional named graph to restrict query to.
    Returns:
        Number of entities of the given type.
    Raises:
        httpx.HTTPStatusError: If the server returns an error status code.
        httpx.RequestError: If there is a network error while making the request.
    """
    graph_clause = f"GRAPH <{graph_uri}> {{\n    " if graph_uri else ""
    graph_end = "\n  }" if graph_uri else ""

    query = f"""
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

    SELECT (COUNT(?entity) as ?count)
    WHERE {{
        {graph_clause}?entity rdf:type <{entity_type}> .
        {graph_end}
    }}
    """
    results = await FusekiClient.sparql_query(dataset_name, query)
    if results and "count" in results[0]:
        try:
            return int(results[0]["count"]["value"])
        except (ValueError, KeyError):
            return 0
    return 0

async def get_entity_properties(dataset_name: str, entity_uri: str, graph_uri: Optional[str] = None) -> list[dict[str, str]]:
    """
    Retrieve all properties of an entity.

    Parameters:
        dataset_name: The name of the dataset to query.
        entity_uri: URI of the entity.
        graph_uri: Optional named graph to restrict query to.
    Returns:
        List of dicts with 'property' and 'value' keys.
    Raises:
        httpx.HTTPStatusError: If the server returns an error status code.
        httpx.RequestError: If there is a network error while making the request.
    """
    graph_clause = f"GRAPH <{graph_uri}> {{\n    " if graph_uri else ""
    graph_end = "\n  }" if graph_uri else ""

    query = f"""
    SELECT ?property ?value
    WHERE {{
        {graph_clause}<{entity_uri}> ?property ?value .
        {graph_end}
    }}
    ORDER BY ?property
    """
    return await FusekiClient.sparql_query(dataset_name, query)