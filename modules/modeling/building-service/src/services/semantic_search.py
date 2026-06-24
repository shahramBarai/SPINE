"""
name: semantic_search.py
description: Provides functions for executing SPARQL queries and performing semantic searches on RDF datasets.

NOTE: This functions was moved from fuseki_sparql_client.py to remove domain-specific logic from the client and keep it focused on SPARQL execution.

TODO: Test and validate the functions in this module to ensure they work correctly with the Fuseki dataset.
"""


from deps import get_fuseki_client, FusekiSparqlError

# --- Initialize database clients ---
FusekiClient = get_fuseki_client()

# --- Service Functions ---
async def execute_sparql_query(dataset_name: str, query: str):
    """
    Executes a SPARQL query against the specified dataset.

    Note: Only supports SELECT, ASK, and CONSTRUCT queries.

    Parameters:
        dataset_name: The name of the dataset to query.
        query: The SPARQL query string to execute.
    Returns:    
        The result of the SPARQL query execution.
    Raises:
        httpx.HTTPStatusError: If the server returns an error status code.
        httpx.RequestError: If there is a network error while making the request.
    """
    return await FusekiClient.sparql_query(dataset_name, query)

async def semantic_search_triples(dataset_name: str, query: str, limit: int = 500) -> list[dict[str, str]]:
    """
    Execute a frontend-provided SPARQL SELECT query and normalize results as triples.

    Parameters:
        dataset_name: The name of the dataset to query.
        query: The SPARQL SELECT query string to execute.
        limit: Maximum number of triples to return (default is 500).
    Returns:
        A list of triples, each represented as a dictionary with keys 'subject', 'predicate', and 'object'.
    Raises:
        FusekiSparqlError: If the query is invalid or does not return the expected variables.
        httpx.HTTPStatusError: If the server returns an error status code.
        httpx.RequestError: If there is a network error while making the request.
    """
    query_text = (query or "").strip()
    if not query_text:
        raise FusekiSparqlError("SPARQL query is required.")

    if "select" not in query_text.lower():
        raise FusekiSparqlError("Only SPARQL SELECT queries are supported.")

    bindings = await FusekiClient.select_query(dataset_name, query_text)
    triples: list[dict[str, str]] = []

    for row in bindings:
        subject = ""
        predicate = ""
        object_value = ""

        if isinstance(row.get("s"), dict):
            subject = str(row["s"].get("value", ""))
        if isinstance(row.get("p"), dict):
            predicate = str(row["p"].get("value", ""))
        if isinstance(row.get("o"), dict):
            object_value = str(row["o"].get("value", ""))

        if not (subject and predicate and object_value):
            if isinstance(row.get("subject"), dict):
                subject = str(row["subject"].get("value", ""))
            if isinstance(row.get("predicate"), dict):
                predicate = str(row["predicate"].get("value", ""))
            if isinstance(row.get("object"), dict):
                object_value = str(row["object"].get("value", ""))

        if subject and predicate and object_value:
            triples.append(
                {
                    "subject": subject,
                    "predicate": predicate,
                    "object": object_value,
                }
            )

        if len(triples) >= max(1, int(limit)):
            break

    if not triples:
        raise FusekiSparqlError(
            "Query must return variables (?s ?p ?o) or (?subject ?predicate ?object)."
        )

    return triples