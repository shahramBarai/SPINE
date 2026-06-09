from typing import Optional

from pydantic import BaseModel
from deps import get_fuseki_client

# --- Initialize database clients ---
FusekiClient = get_fuseki_client()

class GraphServicesSummary(BaseModel):
    type: str
    description: str
    endpoints: list[str]

class GraphInfoResponse(BaseModel):
    name: str
    state: bool
    services: list[GraphServicesSummary]

async def get_graphs() -> list[GraphInfoResponse]:
    """
    Retrieves a list of graph URIs from the Fuseki dataset.

    :return: A list of graph URIs available in the dataset.
    """
    try:
        result = await FusekiClient.get_datasets()
        return [GraphInfoResponse(name=ds["ds.name"], state=ds["ds.state"], services=[
            GraphServicesSummary(
                type=service["srv.type"],
                description=service["srv.description"],
                endpoints=service.get("srv.endpoints", [])
            ) for service in ds.get("ds.services", [])
        ]) for ds in result]
    except Exception:
        return []
    