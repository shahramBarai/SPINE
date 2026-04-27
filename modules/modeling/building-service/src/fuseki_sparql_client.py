"""
name: fuseki_sparql_client.py
description: Query Apache Jena Fuseki using SPARQL (SELECT, CONSTRUCT, ASK).

Provides both raw SPARQL execution and domain-specific helpers for building models.
"""

from __future__ import annotations

import json
from typing import Any, Optional
from urllib import parse, request
from urllib.error import HTTPError, URLError

from rdflib import Graph


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
