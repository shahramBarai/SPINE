import httpx

from fastapi import APIRouter, HTTPException
from services import DatasetService
from typing import Optional

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
async def get_graph_tree(dataset_name: str) -> list[DatasetService.IfcNode]:
    """
    Endpoint to retrieve a tree structure of nodes from the specified dataset.

    **Arguments**:
        dataset_name: The name of the dataset to query.
    **Returns**:
        A tree structure of nodes.
    """
    try:
        return await DatasetService.get_tree(dataset_name)
    except Exception as exc:
        print(f"Error retrieving graph tree: {exc}")
        raise HTTPException(status_code=502, detail="Failed to retrieve graph tree from Fuseki") from exc

@router.get("/dataset/{dataset_name}/sparql")
async def execute_sparql_query(dataset_name: str, query: str):
    """
    Endpoint to execute a SPARQL query against the specified dataset.

    Note: Only supports SELECT, ASK, and CONSTRUCT queries.

    **Arguments**:
        dataset_name: The name of the dataset to query.
        query: The SPARQL query string to execute.
    **Returns**:
        The results of the SPARQL query.
    """
    try:
        return await DatasetService.execute_sparql_query(dataset_name, query)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail=str(exc)) from exc
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail="Network error while connecting to Fuseki") from exc
    except Exception:
        raise HTTPException(status_code=502, detail="Failed to execute SPARQL query on Fuseki")
    

@router.delete("/dataset/{dataset_name}/graph")
async def delete_graph(dataset_name: str, graph_uri: Optional[str] = None):
    """
    Endpoint to delete a graph from the specified dataset.

    **Arguments**:
        dataset_name: The name of the dataset to delete from.
        graph_uri: The URI of the graph to delete. If None, the default graph is targeted.
    **Returns**:
        A message indicating the result of the delete operation.
    """
    try:
        # 1. Validate that the graph exists before attempting deletion
        graphs = await DatasetService.list_graphs(dataset_name)
        target_graph = graph_uri or "default"
        # 2. Proceed to delete the graph only if it exists
        if target_graph in [g.graph_uri for g in graphs]:
            await DatasetService.delete_graph(dataset_name, graph_uri)
        # 3. Return a success message regardless of whether the graph existed or not, 
        # to avoid information leakage about graph existence
        return {"message": "Graph deleted successfully"}
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail=str(exc)) from exc
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail="Network error while connecting to Fuseki") from exc
    except Exception:
        raise HTTPException(status_code=502, detail="Failed to delete graph from Fuseki") from exc