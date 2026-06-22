from typing import Any
from pydantic import BaseModel
import math

def get_binding_value(binding: dict[str, Any], key: str, default: str = "") -> str:
	"""
    Retrieves the value of a binding from a SPARQL query result.

    Parameters:
        binding: The binding dictionary from the SPARQL query result.
        key: The key to look for in the binding (e.g., "s", "p", "o").
        default: The default value to return if the key is not found or if the value is not a dictionary.
    Returns:
        The value associated with the key in the binding, or the default value 
		if the key is not found or if the value is not a dictionary.
    """
	value = binding.get(key)
	if isinstance(value, dict):
		return str(value.get("value", default))
	return default

def get_binding_type(binding: dict[str, Any], key: str) -> str:
	"""
    Retrieves the type of a binding from a SPARQL query result.
	
    Parameters:
        binding: The binding dictionary from the SPARQL query result.
        key: The key to look for in the binding (e.g., "s", "p", "o").
    Returns:
        The type associated with the key in the binding, or an empty string 
		if the key is not found or if the value is not a dictionary.
	"""
	value = binding.get(key)
	if isinstance(value, dict):
		return str(value.get("type", ""))
	return ""

def uri_to_id(uri: str) -> str:
	"""
    Converts a URI to a simplified ID by extracting the last segment after '#' or '/'.

    Parameters:
        uri: The URI string to convert.
    Returns:
        A simplified ID extracted from the URI.
	"""
	if "#" in uri:
		return uri.rsplit("#", maxsplit=1)[-1]
	if "/" in uri:
		return uri.rsplit("/", maxsplit=1)[-1]
	return uri

class TripleDto(BaseModel):
	subject: str
	predicate: str
	object: str

def extract_triple(binding: dict[str, Any]) -> tuple[TripleDto | None, bool]:
	"""
    Extracts a triple from a SPARQL query binding. It looks for common keys ("s", "p", "o" or
    "subject", "predicate", "object") to identify the subject, predicate, and object of the triple. 
	It also determines if the object is a node (URI or blank node) based on its type.
	
    Parameters:
        binding: The binding dictionary from the SPARQL query result.
    Returns:
        A tuple containing the extracted TripleDto and a boolean indicating whether the object is a node.
	"""
	for subject_key, predicate_key, object_key in (("s", "p", "o"), ("subject", "predicate", "object")):
		subject = get_binding_value(binding, subject_key)
		predicate = get_binding_value(binding, predicate_key)
		obj = get_binding_value(binding, object_key)
		if subject and predicate and obj:
			object_type = get_binding_type(binding, object_key)
			object_is_node = object_type in {"uri", "bnode"}
			return TripleDto(subject=subject, predicate=predicate, object=obj), object_is_node

	return None, False

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

def _short_name(uri: str) -> str:
    identifier = uri_to_id(uri)
    return identifier.replace("_", " ")

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

def build_graph_from_triples(triples: list[TripleDto], edge_enabled: list[bool], focus_id: str | None = None) -> GraphDto:
    edges_raw: list[GraphEdgeDto] = []
    nodes_by_id: dict[str, GraphNodeDto] = {}

    for triple, include_edge in zip(triples, edge_enabled):
        if not include_edge:
            continue

        from_id = uri_to_id(triple.subject)
        to_id = uri_to_id(triple.object)
        label = uri_to_id(triple.predicate)
        if not from_id or not to_id:
            continue

        edges_raw.append(
            GraphEdgeDto(from_id=from_id, to_id=to_id, label=label)
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