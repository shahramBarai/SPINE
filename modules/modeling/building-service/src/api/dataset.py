import httpx

from fastapi import APIRouter, HTTPException
from services import DatasetService

router = APIRouter(prefix="/api", tags=["Dataset Operations"])

@router.get("/datasets", response_model=list[DatasetService.DatasetInfo])
async def get_dataset_info() -> list[DatasetService.DatasetInfo]:
    """
    Endpoint to list all datasets within the Fuseki server along with their state and available services.

    **Returns**:
        A list of dataset information.
    """
    try:
        return await DatasetService.get_datasets_info()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail=str(exc)) from exc
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail="Network error while connecting to Fuseki") from exc
    except Exception:
        raise HTTPException(status_code=502, detail="Failed to retrieve datasets from Fuseki")
    
@router.get("/dataset/{dataset_name}/graphs")
async def list_graphs(dataset_name: str) -> list[DatasetService.GraphInfoResponse]:
    """
    Endpoint to list all graph URIs within a specified dataset.

    **Arguments**:
        dataset_name: The name of the dataset to query.
    **Returns**:
        A list of graph information available in the dataset.
    """
    try:
        return await DatasetService.list_graphs(dataset_name)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail=str(exc)) from exc
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail="Network error while connecting to Fuseki") from exc
    except Exception:
        raise HTTPException(status_code=502, detail="Failed to retrieve graph data from Fuseki")

@router.get("/dataset/{dataset_name}/tree", response_model=list[DatasetService.IfcNode])
async def get_graph_tree(dataset_name: str, graph_uri: str) -> list[DatasetService.IfcNode]:
    """
    Endpoint to retrieve a tree structure of nodes from the specified dataset.

    **Arguments**:
        dataset_name: The name of the dataset to query.
        graph_uri: The URI of the graph to query.
    **Returns**:
        A tree structure of nodes.
    """
    try:
        return await DatasetService.get_tree(dataset_name, graph_uri)
    except Exception as exc:
        print(f"Error retrieving graph tree: {exc}")
        raise HTTPException(status_code=502, detail="Failed to retrieve graph tree from Fuseki") from exc