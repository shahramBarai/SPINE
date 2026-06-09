import httpx
from typing import Optional, Dict, Any

class FusekiSparqlError(RuntimeError):
    """Raised when a Fuseki SPARQL query fails."""

class FusekiClient:
    def __init__(self, base_url: str, username: str, password: str):
        """
        Initializes the Fuseki client.
        
        :param base_url: The root URL of the Fuseki server (e.g., "http://localhost:3030")
        :param username: The username for authentication.
        :param password: The password for authentication.
        """
        # Ensure base_url doesn't end with a trailing slash for clean path joining
        self.base_url = base_url.rstrip('/')
        
        # Setup basic authentication if your Fuseki server is secured
        auth = (username, password) if username and password else None
        
        # Initialize the persistent asynchronous client
        self.client = httpx.AsyncClient(
            base_url=self.base_url,
            auth=auth,
            timeout=30.0  # Graph queries can take longer than standard SQL queries
        )

    async def close(self):
        """
        Closes the underlying HTTPX asynchronous client connection pool.
        """
        await self.client.aclose()

    # --- SPARQL query and update methods ---

    def _normalize_and_check_query_string(self, query: str, allowed_types: list[str]) -> str:
        """
        Normalizes the query string and checks if it starts with an allowed SPARQL query type.

        :param query: The raw SPARQL query string.
        :param allowed_types: A list of allowed SPARQL query types (e.g., ["select", "ask"]).
        :return: The normalized query string if valid.
        :raises FusekiSparqlError: If the query is empty or does not start with an allowed type.
        """
        query_text = (query or "").strip()
        if not query_text:
            raise FusekiSparqlError("SPARQL query is required.")

        if not any(query_text.lower().startswith(qt) for qt in allowed_types):
            raise FusekiSparqlError(f"Only SPARQL {', '.join(allowed_types).upper()} queries are supported.")

        return query_text

    async def sparql_query(self, dataset_name: str, query: str) -> list[Dict[str, Any]]:
        """
        Executes a SPARQL query via HTTP POST. Implements the W3C SPARQL 1.1 Protocol.

        Important: This method is designed for SPARQL SELECT, ASK, CONSTRUCT, and DESCRIBE queries.
        For change operations (INSERT, DELETE and DROP), see the `update` method.

        :param dataset_name: The name of the dataset to query.
        :param query: The SPARQL query string to execute.
        :return: A list of query results (bindings) or None if an error occurs.
        :raises FusekiSparqlError: If the query is invalid or does not start with an allowed type.
        :raises httpx.HTTPStatusError: If the server returns an error status code.
        :raises httpx.RequestError: If there is a network error while making the request.
        """

        # Check if the query is valid and starts with an allowed SPARQL query type
        query_text = self._normalize_and_check_query_string(
            query,
            allowed_types=["select", "ask", "construct", "describe"]
        )
        endpoint = f"/{dataset_name}/query"
        
        # We specify the content type for SPARQL queries and accept JSON results
        headers = {
            "Content-Type": "application/sparql-query",
            "Accept": "application/sparql-results+json"
        }

        response = await self.client.post(endpoint, content=query_text, headers=headers)
        response.raise_for_status()
        
        try:
            return response.json().get("results", {}).get("bindings", [])
        except ValueError:
            return []
        
    async def sparql_update(self, dataset_name: str, query: str):
        """
        Executes a SPARQL Update operation (INSERT, DELETE, DROP) via HTTP POST.

        :param dataset_name: The name of the dataset to update.
        :param query: The SPARQL update string to execute.
        :raises httpx.HTTPStatusError: If the server returns an error status code.
        :raises httpx.RequestError: If there is a network error while making the request.
        """
        # Check if the update string is valid and starts with an allowed SPARQL update type
        query_text = self._normalize_and_check_query_string(
            query,
            allowed_types=["insert", "delete", "drop"]
        )

        endpoint = f"/{dataset_name}/update"
        headers = {
            "Content-Type": "application/sparql-update"
        }

        response = await self.client.post(endpoint, content=query_text, headers=headers)
        response.raise_for_status()

    # --- Graph Store Protocol methods for direct graph manipulation ---

    async def graph_get_ttl(self, dataset_name: str, graph_uri: Optional[str] = None) -> str:
        """
        Retrieves the RDF graph in Turtle format using Grapth Store Protocol.

        :param dataset_name: The name of the dataset containing the graph.
        :param graph_uri: The URI of the graph to retrieve. If None, the default graph is returned.
        :return: The RDF graph in Turtle format as a string.
        :raises httpx.HTTPStatusError: If the server returns an error status code.
        :raises httpx.RequestError: If there is a network error while making the request.
        """
        endpoint = f"/{dataset_name}/data"
        params = {"graph": graph_uri} if graph_uri else {"default": ""}
        headers = {
            "Accept": "text/turtle; charset=utf-8"
        }

        response = await self.client.get(endpoint, headers=headers, params=params)
        response.raise_for_status()
        
        return response.text
    
    async def graph_upload_ttl(self, dataset_name: str, payload: bytes, graph_uri: Optional[str] = None):
        """
        Uploads RDF data in Turtle format to a specified graph.

        :param dataset_name: The name of the dataset containing the graph.
        :param graph_uri: The URI of the graph to upload to. If None, the default graph is targeted.
        :param payload: The RDF data in Turtle format as bytes.
        :raises httpx.HTTPStatusError: If the server returns an error status code.
        :raises httpx.RequestError: If there is a network error while making the request.
        """
        endpoint = f"/{dataset_name}/data"
        params = {"graph": graph_uri} if graph_uri else {"default": ""}
        headers = {
            "Content-Type": "text/turtle"
        }
        
        response = await self.client.post(endpoint, headers=headers, params=params, content=payload)
        response.raise_for_status()
    
    # --- Additional utility methods for operational stats and dataset management ---

    async def get_datasets(self) -> list[dict[str, Any]]:
        """
        Retrieves a list of dataset names available on the Fuseki server.

        :return: A list of dataset information dictionaries.
        :raises httpx.HTTPStatusError: If the server returns an error status code.
        :raises httpx.RequestError: If there is a network error while making the request.
        """
        response = await self.client.get("/$/datasets")
        response.raise_for_status()
        return response.json().get("datasets", [])

    async def get_operational_stats(self, dataset_name: str) -> dict:
        """
        Retrieves request counters and error metrics for this specific dataset.
        
        :param dataset_name: The name of the dataset to retrieve stats for.
        :return: A dictionary containing request counts and error metrics.
        :raises httpx.HTTPStatusError: If the server returns an error status code.
        :raises httpx.RequestError: If there is a network error while making the request.
        """
        response = await self.client.get(f"/$/stats/{dataset_name}")
        response.raise_for_status()
        return response.json()