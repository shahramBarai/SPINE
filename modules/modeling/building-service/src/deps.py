import os

from fuseki_sparql_client import FusekiSparqlClient, FusekiSparqlError
from db.timescale_client import TimescaleClient

# --- Load configuration from environment variables with defaults ---

FUSEKI_BASE_URL = os.getenv("FUSEKI_BASE_URL", "http://localhost:3030")
FUSEKI_DATASET = os.getenv("FUSEKI_DATASET", "spine")

DATABASE_URL_TIMESCALE = os.getenv(
    "DATABASE_URL_TIMESCALE", "username:password@localhost:5433/timescale"
)

# --- Initialize clients ---

fusekiSparqlClient: FusekiSparqlClient | None = None
timescaleClient: TimescaleClient | None = None


def get_fuseki_client() -> FusekiSparqlClient:
    """
    Get a singleton instance of the FusekiSparqlClient. The client is initialized on first use.

    Returns:
        An instance of FusekiSparqlClient connected to the configured Fuseki endpoint and dataset
    """
    global fusekiSparqlClient
    if fusekiSparqlClient is None:
        fusekiSparqlClient = FusekiSparqlClient(
            base_url=FUSEKI_BASE_URL, dataset=FUSEKI_DATASET
        )
    return fusekiSparqlClient


def get_timescale_client() -> TimescaleClient:
    """
    Get a singleton instance of the TimescaleClient. The connection pool is established on first use.
    
    Returns:
        An instance of TimescaleClient with an active connection pool.
    """
    global timescaleClient
    if timescaleClient is None:
        timescaleClient = TimescaleClient(database_url=DATABASE_URL_TIMESCALE)
    return timescaleClient

__all__ = ["get_fuseki_client", "get_timescale_client", "FusekiSparqlError"]