import os

from db.fuseki_client import FusekiClient, FusekiSparqlError
from db.timescale_client import TimescaleClient

# --- Load configuration from environment variables with defaults ---

FUSEKI_BASE_URL = os.getenv("FUSEKI_BASE_URL", "http://localhost:3030")
FUSEKI_USERNAME = os.getenv("FUSEKI_USERNAME", "admin")
FUSEKI_PASSWORD = os.getenv("FUSEKI_PASSWORD", "admin123")
FUSEKI_DATASET = os.getenv("FUSEKI_DATASET", "spine")

DATABASE_URL_TIMESCALE = os.getenv(
    "DATABASE_URL_TIMESCALE", "username:password@localhost:5433/timescale"
)

# --- Initialize clients ---

fusekiClient: FusekiClient | None = None
timescaleClient: TimescaleClient | None = None

def get_fuseki_client() -> FusekiClient:
    """
    Get a singleton instance of the FusekiClient. The connection pool is established on first use.
    
    Returns:
        An instance of FusekiClient with an active connection pool.
    """
    global fusekiClient
    if fusekiClient is None:
        fusekiClient = FusekiClient(
            base_url=FUSEKI_BASE_URL,
            username=FUSEKI_USERNAME,
            password=FUSEKI_PASSWORD
        )
    return fusekiClient

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