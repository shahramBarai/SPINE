"""
name: fuseki_sparql_client.py
description: Query Apache Jena Fuseki using SPARQL (SELECT, CONSTRUCT, ASK).

Provides both raw SPARQL execution and domain-specific helpers for building models.
"""

from __future__ import annotations

import json
import tempfile
import webbrowser
from typing import Any, Optional
from urllib import parse, request
from urllib.error import HTTPError, URLError

from rdflib import BNode, Graph, Literal, URIRef


class FusekiSparqlError(RuntimeError):
    """Raised when a Fuseki SPARQL query fails."""


class FusekiSparqlClient:
    """Client for SPARQL queries against Apache Jena Fuseki."""

    def __init__(self, base_url: str = "http://localhost:3030", dataset: str = "dataset") -> None:
        self.base_url = base_url.rstrip("/")
        self.dataset = dataset.strip("/")
        self.query_endpoint = f"{self.base_url}/{self.dataset}/sparql"

    def _request_sparql(
        self, query: str, output_format: str = "application/sparql-results+json"
    ) -> str:
        """Execute SPARQL query and return raw response."""
        params = parse.urlencode({"query": query})
        url = f"{self.query_endpoint}?{params}"

        headers = {"Accept": output_format}
        req = request.Request(url=url, method="GET", headers=headers)

        try:
            with request.urlopen(req) as resp:
                return resp.read().decode("utf-8", errors="replace")
        except HTTPError as exc:
            error_body = exc.read().decode("utf-8", errors="replace")
            raise FusekiSparqlError(
                f"SPARQL query failed: HTTP {exc.code}. {error_body}"
            ) from exc
        except URLError as exc:
            raise FusekiSparqlError(f"Cannot reach Fuseki at {self.query_endpoint}: {exc.reason}") from exc

    def select_query(self, query: str) -> list[dict[str, Any]]:
        """
        Execute a SPARQL SELECT query.

        Args:
            query: SPARQL SELECT query string.

        Returns:
            List of result bindings (dicts with variable names as keys).
        """
        response = self._request_sparql(query, output_format="application/sparql-results+json")
        data = json.loads(response)
        return data.get("results", {}).get("bindings", [])

    def construct_query(self, query: str) -> Graph:
        """
        Execute a SPARQL CONSTRUCT query.

        Args:
            query: SPARQL CONSTRUCT query string.

        Returns:
            RDF graph with constructed triples.
        """
        response = self._request_sparql(query, output_format="text/turtle")
        g = Graph()
        g.parse(data=response, format="turtle")
        return g

    def ask_query(self, query: str) -> bool:
        """
        Execute a SPARQL ASK query.

        Args:
            query: SPARQL ASK query string.

        Returns:
            True if the query matches, False otherwise.
        """
        response = self._request_sparql(query, output_format="application/sparql-results+json")
        data = json.loads(response)
        return data.get("boolean", False)

    # --- Domain-specific helpers for building models ---

    def get_buildings(self, graph_uri: Optional[str] = None) -> list[dict[str, str]]:
        """
        Retrieve all BOT buildings in the dataset.

        Args:
            graph_uri: Optional named graph to restrict query to.

        Returns:
            List of dicts with 'building' and 'label' keys.
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
        return self.select_query(query)

    def get_spaces(self, building_uri: Optional[str] = None, graph_uri: Optional[str] = None) -> list[dict[str, str]]:
        """
        Retrieve all BOT spaces, optionally within a building.

        Args:
            building_uri: Optional building URI to filter by.
            graph_uri: Optional named graph to restrict query to.

        Returns:
            List of dicts with 'space', 'label', and 'type' keys.
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
        return self.select_query(query)

    def get_space_adjacencies(self, space_uri: str, graph_uri: Optional[str] = None) -> list[dict[str, str]]:
        """
        Retrieve adjacent spaces (space-to-space relationships).

        Args:
            space_uri: URI of the space to find adjacencies for.
            graph_uri: Optional named graph to restrict query to.

        Returns:
            List of dicts with 'adjacent_space' and 'adjacent_label' keys.
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
        return self.select_query(query)

    def get_systems(self, building_uri: Optional[str] = None, graph_uri: Optional[str] = None) -> list[dict[str, str]]:
        """
        Retrieve all systems (HVAC, electrical, etc.) in a building.

        Args:
            building_uri: Optional building URI to filter by.
            graph_uri: Optional named graph to restrict query to.

        Returns:
            List of dicts with 'system', 'label', and 'type' keys.
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
        return self.select_query(query)

    def get_system_components(
        self, system_uri: str, graph_uri: Optional[str] = None
    ) -> list[dict[str, str]]:
        """
        Retrieve components (terminals, controllers, devices) in a system.

        Args:
            system_uri: URI of the system.
            graph_uri: Optional named graph to restrict query to.

        Returns:
            List of dicts with 'component', 'label', and 'type' keys.
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
        return self.select_query(query)

    def get_sensors(self, space_uri: Optional[str] = None, graph_uri: Optional[str] = None) -> list[dict[str, str]]:
        """
        Retrieve sensor instances, optionally within a space.

        Args:
            space_uri: Optional space URI to filter sensors by location.
            graph_uri: Optional named graph to restrict query to.

        Returns:
            List of dicts with 'sensor', 'label', 'observable', and 'unit' keys.
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
        return self.select_query(query)

    def get_space_points(self, space_uri: str, graph_uri: Optional[str] = None) -> list[dict[str, str]]:
        """
        Retrieve all points (sensors, setpoints, etc.) associated with a space.

        Args:
            space_uri: URI of the space.
            graph_uri: Optional named graph to restrict query to.

        Returns:
            List of dicts with 'point', 'label', and 'type' keys.
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
        return self.select_query(query)

    def count_entities(self, entity_type: str, graph_uri: Optional[str] = None) -> int:
        """
        Count entities of a specific RDF type.

        Args:
            entity_type: Full URI of the entity type (e.g., "https://w3id.org/bot#Space").
            graph_uri: Optional named graph to restrict query to.

        Returns:
            Number of entities of the given type.
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
        results = self.select_query(query)
        if results and "count" in results[0]:
            try:
                return int(results[0]["count"]["value"])
            except (ValueError, KeyError):
                return 0
        return 0

    def get_entity_properties(self, entity_uri: str, graph_uri: Optional[str] = None) -> list[dict[str, str]]:
        """
        Retrieve all properties of an entity.

        Args:
            entity_uri: URI of the entity.
            graph_uri: Optional named graph to restrict query to.

        Returns:
            List of dicts with 'property' and 'value' keys.
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
        return self.select_query(query)

    def construct_lvi_ark_equivalence_example(self) -> Graph:
        """
        Example CONSTRUCT query for LVI/ARK equivalence and sampled elements/spaces.

        Returns:
            RDF graph produced by the example CONSTRUCT query.
        """
        query = """
        PREFIX inst:  <https://lbd.example.com/>
        PREFIX bot:   <https://w3id.org/bot#>
        PREFIX brick: <https://brickschema.org/schema/Brick#>
        PREFIX rdf:   <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        PREFIX rdfs:  <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX owl:   <http://www.w3.org/2002/07/owl#>

        CONSTRUCT {
            # LVI model
            inst:site_65e0e88e-5ebd-42b6-b2fa-1c43557cea67 bot:hasBuilding ?building .
            ?building bot:hasStorey ?storey .
            ?storey bot:containsElement ?element .
            ?system brick:hasPart ?element .
            ?system rdf:type brick:System .

            # ARK model
            inst:site_28cb49f1-9b69-4870-aca3-d3f3628a7f67 bot:hasBuilding ?buildingEq .
            ?buildingEq bot:hasStorey ?storeyEq .
            ?storeyEq bot:hasSpace ?space .
            ?space brick:isPointOf ?sensor .
            ?sensor rdf:type ?typeS .

            # Equivalences (only output if they exist)
            inst:site_65e0e88e-5ebd-42b6-b2fa-1c43557cea67 owl:sameAs inst:site_28cb49f1-9b69-4870-aca3-d3f3628a7f67 .
            inst:site_65e0e88e-5ebd-42b6-b2fa-1c43557cea67 a bot:Site .
            inst:site_28cb49f1-9b69-4870-aca3-d3f3628a7f67 a bot:Site .
            ?building owl:sameAs ?buildingEq .
            ?storey owl:sameAs ?storeyEq .
        }
        WHERE {
            # --- LVI Buildings and Storeys ---
            inst:site_65e0e88e-5ebd-42b6-b2fa-1c43557cea67 bot:hasBuilding ?building .
            ?building a bot:Building .
            FILTER(!CONTAINS(LCASE(STR(?building)), "ifc"))

            ?building bot:hasStorey ?storey .
            ?storey a bot:Storey .
            FILTER(!CONTAINS(LCASE(STR(?storey)), "ifc"))

            # Check that buildingEq belongs to ARK site
            inst:site_28cb49f1-9b69-4870-aca3-d3f3628a7f67 bot:hasBuilding ?buildingEq .

            # --- Use existing owl:sameAs to find equivalent building ---
            ?building (owl:sameAs|^owl:sameAs) ?buildingEq .
            ?buildingEq a bot:Building .
            FILTER(!CONTAINS(LCASE(STR(?buildingEq)), "ifc"))

            # --- Use existing owl:sameAs to find equivalent storey ---
            ?storey (owl:sameAs|^owl:sameAs) ?storeyEq .
            ?storeyEq a bot:Storey .
            FILTER(!CONTAINS(LCASE(STR(?storeyEq)), "ifc"))

            # Check that storeyEq belongs to buildingEq
            ?buildingEq bot:hasStorey ?storeyEq .

            # --- ONE SYSTEM ELEMENT per storey (if exists) ---
            OPTIONAL {
                SELECT ?storey (SAMPLE(?el) AS ?element) (SAMPLE(?sys) AS ?system)
                WHERE {
                    ?storey bot:containsElement ?el .
                    ?sys brick:hasPart ?el .
                    ?sys a brick:System .
                }
                GROUP BY ?storey
            }

            # --- ONE SPACE per storey (if exists) ---
            OPTIONAL {
                SELECT ?storeyEq (SAMPLE(?s) AS ?space) (SAMPLE(?snr) AS ?sensor) (SAMPLE(?t) AS ?typeS)
                WHERE {
                    ?storeyEq bot:hasSpace ?s .
                    ?s a bot:Space .
                    ?s brick:hasPoint ?snr .
                    ?snr rdf:type ?t .
                    VALUES ?t {
                      brick:CO2_Sensor
                      brick:Room_Air_Temperature_Sensor
                      brick:Humidity_Sensor
                    }
                }
                GROUP BY ?storeyEq
            }
        }
        """
        return self.construct_query(query)


def _short_term(value: Any, max_len: int = 80) -> str:
    if isinstance(value, URIRef):
        text = str(value)
        if "#" in text:
            text = text.rsplit("#", 1)[-1]
        elif "/" in text:
            text = text.rstrip("/").rsplit("/", 1)[-1]
    elif isinstance(value, BNode):
        text = f"_:{value}"
    elif isinstance(value, Literal):
        text = str(value)
    else:
        text = str(value)

    text = text.replace("\\", "\\\\").replace('"', '\\"')
    if len(text) > max_len:
        return text[: max_len - 3] + "..."
    return text


def _graph_to_dot(graph: Graph) -> str:
    node_ids: dict[Any, str] = {}
    lines = [
        "digraph RDFGraph {",
        "  rankdir=LR;",
        "  node [shape=box, style=rounded, fontsize=10];",
    ]

    def node_id(term: Any) -> str:
        if term not in node_ids:
            node_ids[term] = f"n{len(node_ids)}"
            label = _short_term(term)
            if isinstance(term, Literal):
                lines.append(f'  {node_ids[term]} [label="{label}", shape=note];')
            elif isinstance(term, BNode):
                lines.append(f'  {node_ids[term]} [label="{label}", shape=ellipse];')
            else:
                lines.append(f'  {node_ids[term]} [label="{label}"];')
        return node_ids[term]

    for s, p, o in graph:
        sid = node_id(s)
        oid = node_id(o)
        plabel = _short_term(p, max_len=60)
        lines.append(f'  {sid} -> {oid} [label="{plabel}"];')

    lines.append("}")
    return "\n".join(lines)


def _show_graph_popup(graph: Graph) -> None:
        """Open an interactive graph viewer in the browser (zoom/pan/drag/search)."""
        if len(graph) == 0:
                print("No triples to visualize.")
                return

        node_ids: dict[Any, int] = {}
        nodes_payload: list[dict[str, Any]] = []
        edges_payload: list[dict[str, Any]] = []

        def node_id(term: Any) -> int:
                if term not in node_ids:
                        nid = len(node_ids) + 1
                        node_ids[term] = nid
                        label = _short_term(term, 36)
                        title = str(term)
                        if isinstance(term, Literal):
                                color = "#f59e0b"
                                shape = "box"
                        elif isinstance(term, BNode):
                                color = "#3b82f6"
                                shape = "ellipse"
                        else:
                                color = "#0ea5e9"
                                shape = "dot"

                        nodes_payload.append(
                                {
                                        "id": nid,
                                        "label": label,
                                        "title": title,
                                        "shape": shape,
                                        "color": {"background": "#ffffff", "border": color, "highlight": {"border": "#ef4444", "background": "#fee2e2"}},
                                        "font": {"size": 14},
                                }
                        )
                return node_ids[term]

        for s, p, o in graph:
                sid = node_id(s)
                oid = node_id(o)
                edges_payload.append(
                        {
                                "from": sid,
                                "to": oid,
                                "label": _short_term(p, 28),
                                "title": str(p),
                                "arrows": "to",
                                "color": {"color": "#9ca3af", "highlight": "#ef4444"},
                                "font": {"align": "middle", "size": 11},
                                "smooth": {"type": "dynamic"},
                        }
                )

        html = f"""<!doctype html>
<html>
<head>
    <meta charset=\"utf-8\" />
    <title>Fuseki Graph Visualization</title>
    <script src=\"https://unpkg.com/vis-network@9.1.9/dist/vis-network.min.js\"></script>
    <style>
        body {{ margin: 0; font-family: Segoe UI, sans-serif; background: #f8fafc; }}
        #toolbar {{ display: flex; gap: 8px; align-items: center; padding: 10px 14px; border-bottom: 1px solid #e2e8f0; background: #ffffff; }}
        #mynetwork {{ width: 100vw; height: calc(100vh - 56px); }}
        input {{ padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px; min-width: 260px; }}
        button {{ padding: 6px 10px; border: 1px solid #cbd5e1; background: #ffffff; border-radius: 6px; cursor: pointer; }}
        .meta {{ margin-left: auto; color: #334155; font-size: 13px; }}
    </style>
</head>
<body>
    <div id=\"toolbar\">
        <input id=\"search\" type=\"text\" placeholder=\"Search node label...\" />
        <button id=\"fitBtn\">Fit</button>
        <button id=\"physicsBtn\">Toggle Physics</button>
        <span class=\"meta\">Nodes: {len(nodes_payload)} | Edges: {len(edges_payload)}</span>
    </div>
    <div id=\"mynetwork\"></div>

    <script>
        const nodes = new vis.DataSet({json.dumps(nodes_payload)});
        const edges = new vis.DataSet({json.dumps(edges_payload)});
        const container = document.getElementById('mynetwork');
        const data = {{ nodes, edges }};
        let physicsEnabled = true;

        const options = {{
            autoResize: true,
            interaction: {{ hover: true, multiselect: true, navigationButtons: true, keyboard: true }},
            physics: {{
                enabled: true,
                stabilization: {{ iterations: 250 }},
                barnesHut: {{ gravitationalConstant: -3500, springLength: 160, damping: 0.35 }}
            }},
            edges: {{
                width: 1.2,
                selectionWidth: 2.2
            }},
            nodes: {{
                borderWidth: 2,
                size: 14,
                mass: 1.2
            }}
        }};

        const network = new vis.Network(container, data, options);

        document.getElementById('fitBtn').addEventListener('click', () => network.fit({{ animation: true }}));
        document.getElementById('physicsBtn').addEventListener('click', () => {{
            physicsEnabled = !physicsEnabled;
            network.setOptions({{ physics: {{ enabled: physicsEnabled }} }});
        }});

        const baseNodes = nodes.get();
        document.getElementById('search').addEventListener('input', (ev) => {{
            const q = ev.target.value.trim().toLowerCase();
            const updated = baseNodes.map(n => {{
                const match = !q || (n.label && n.label.toLowerCase().includes(q)) || (n.title && n.title.toLowerCase().includes(q));
                return {{
                    ...n,
                    hidden: !match,
                    color: match ? n.color : {{ background: '#f1f5f9', border: '#cbd5e1' }}
                }};
            }});
            nodes.update(updated);
            if (q) {{
                const visible = updated.filter(n => !n.hidden).map(n => n.id);
                if (visible.length) network.fit({{ nodes: visible, animation: true }});
            }}
        }});
    </script>
</body>
</html>
"""

        with tempfile.NamedTemporaryFile(mode="w", suffix="_fuseki_graph.html", delete=False, encoding="utf-8") as f:
                f.write(html)
                html_path = f.name

        webbrowser.open(f"file:///{html_path.replace('\\\\', '/')}")
        print(f"Opened interactive graph viewer: {html_path}")


if __name__ == "__main__":
    client = FusekiSparqlClient(
        base_url="http://localhost:3030",
        dataset="spine",
    )
    graph = client.construct_lvi_ark_equivalence_example()
    print(f"Constructed triples: {len(graph)}")

    # output_dir = Path(__file__).resolve().parent
    # ttl_path = output_dir / "lvi_ark_equivalence_construct.ttl"
    # dot_path = output_dir / "lvi_ark_equivalence_construct.dot"
    # png_path = output_dir / "lvi_ark_equivalence_construct.png"

    # graph.serialize(destination=str(ttl_path), format="turtle")
    # dot_path.write_text(_graph_to_dot(graph), encoding="utf-8")

    # print(f"Saved Turtle graph to: {ttl_path}")
    # print(f"Saved DOT visualization to: {dot_path}")

    # dot_exe = shutil.which("dot")
    # if dot_exe:
    #     completed = subprocess.run(
    #         [dot_exe, "-Tpng", str(dot_path), "-o", str(png_path)],
    #         capture_output=True,
    #         text=True,
    #         check=False,
    #     )
    #     if completed.returncode == 0:
    #         print(f"Saved PNG visualization to: {png_path}")
    #     else:
    #         print("Graphviz 'dot' was found, but PNG generation failed.")
    #         if completed.stderr:
    #             print(completed.stderr.strip())
    # else:
    #     print("Graphviz 'dot' not found. Install Graphviz to also generate PNG.")

    _show_graph_popup(graph)
