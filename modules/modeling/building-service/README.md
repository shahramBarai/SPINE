# Modeling Module - Building Service

The Building Service in the Modeling module provides IFC-to-TTL conversion, RDF link generation, and a small FastAPI service on top of them for SPINE building models.

## Purpose

- Convert IFC files into Linked Building Data (TTL)
- Normalize TTL encoding issues
- Generate linksets for skeleton, system, geometry, and sensor relations
- Serve conversions over HTTP for the SPINE backend to call (see `BuildingServiceClient` / `BUILDING_SERVICE_URL` in `modules/app/backend`)

## Directory Structure

```
modules/modeling/building-service/
├── README.md
├── BUILDING_SERVICE_SUMMARY.md
└── src/
    ├── requirements.txt
    ├── server.py                FastAPI app entry point
    ├── routers/                 HTTP endpoints
    │   ├── health.py
    │   └── pipeline.py
    ├── conversion/
    │   └── ifc_to_lbd.py        IFC->TTL conversion + in-memory job tracking, used by routers/pipeline.py
    ├── scripts/                 standalone CLI/library scripts - not used by the HTTP API
    │   ├── ifc_lbd_converter.py
    │   ├── graph_manager.py
    │   ├── ttl_skeleton_link.py
    │   ├── ttl_ifc_system_link.py
    │   ├── ttl_ifc_geom_link.py
    │   └── ttl_sensor_link.py
    ├── utils/
    │   ├── file_utils.py
    │   ├── encoding_utils.py
    │   └── sparql_helpers.py
    └── java_files/
        ├── IFCtoLBD_CLI.jar     IFCtoLBD converter CLI
        └── config.json          gitignored - JVM hardware flags, create locally
```

## Current Script Inventory

Stable scripts, all under `src/scripts/`:

- ifc_lbd_converter.py: IFC to TTL conversion CLI, wraps conversion/ifc_to_lbd.py's Java call
- graph_manager.py: RDF namespace setup and graph save helpers, shared by the linking scripts below
- ttl_skeleton_link.py: links architecture and MEP skeleton entities (site, building, storey)
- ttl_ifc_system_link.py: adds IFC system instances and links terminals/components to spaces
- ttl_ifc_geom_link.py: computes adjacency links (space-space, space-wall, MEP component connectivity)
- ttl_sensor_link.py: creates sensor instances from JSON and links sensors to BOT spaces

`src/utils/encoding_utils.py` fixes TTL encoding issues and is used by both the scripts above and, separately, by `src/conversion/ifc_to_lbd.py`'s own HTTP-triggered conversions.

## Prerequisites

- Python 3.10+
- Java (required by the IFCtoLBD conversion step)
- Native deps for ifcopenshell/shapely/rtree/trimesh as needed by your platform

Install Python dependencies:

```bash
cd modules/modeling/building-service/src
pip install -r requirements.txt
```

## Configuration

JVM/conversion hardware flags are read from `src/java_files/config.json` (gitignored - create it locally):

```json
{ "hardware": ["-Xmx4g"] }
```

A missing file is fine - the converter falls back to no extra flags.

## HTTP API (FastAPI)

`server.py` exposes the pipeline over HTTP for the SPINE backend to call. Run it via:

```bash
cd modules/modeling/building-service/src
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

Optional environment variable:

- `FRONTEND_ORIGIN` - comma-separated CORS origins (default `http://localhost:5173`; any `localhost`/`127.0.0.1`/bare-IPv4 origin is always allowed regardless of this setting, on any port)

Endpoints:

- `GET /api/health` - liveness check, no external dependencies
- `POST /api/pipeline/upload` - upload an .ifc/.ttl file (multipart, up to 1000 MB)
- `GET /api/pipeline/download?filename=` - download a previously uploaded/converted file
- `POST /api/pipeline/convert/ifc-to-ttl?filename=` - start a background conversion job, returns a `job_id`
- `GET /api/pipeline/convert/job?job_id=` - poll one conversion job's status
- `GET /api/pipeline/convert/jobs` - list every conversion job (in-memory, reset on restart)

Uploaded and converted files are stored under `/tmp/spine_building_service`, not yet backed by MinIO (see the `TODO` in `routers/pipeline.py`) - they don't survive a restart. There is no endpoint here that uploads TTL into Fuseki; that happens through the main app (see "Recommended End-to-End Order" below).

## Running the standalone scripts

The scripts under `src/scripts/` are separate from the HTTP API - they're function libraries, run from `src/` so `scripts`/`utils`/`conversion` resolve as packages:

```bash
cd modules/modeling/building-service/src
python -m scripts.ifc_lbd_converter -f "/path/to/model.ifc"
python -m scripts.ifc_lbd_converter -d "/path/to/IFC"
```

### Encoding normalization

```bash
python -c "from utils.encoding_utils import process_path; process_path('/path/to/TTL')"
```

### Skeleton linking (site/building/storey)

```bash
python -c "from scripts.ttl_skeleton_link import link_folder_skeletons; link_folder_skeletons('/path/to/ARC.ttl', '/path/to/MEP_TTL_FOLDER', '/path/to/output_linkset.ttl')"
```

### System and terminal-to-space linking

```bash
python -c "from scripts.ttl_ifc_system_link import link_mep_system_ttl; link_mep_system_ttl('/path/to/MEP_IFC_FOLDER', '/path/to/MEP_TTL_FOLDER', '/path/to/ARC.ifc', '/path/to/ARC.ttl', ['IfcFlowTerminal','IfcFlowController','IfcDistributionControlElement','IfcEnergyConversionDevice','IfcFlowMovingDevice','IfcFlowStorageDevice','IfcFlowTreatmentDevice','IfcBuildingElementProxy'], '/path/to/linked_systems_elements.ttl')"
```

### Geometry-based linking

```bash
python -c "from scripts.ttl_ifc_geom_link import link_arc_spaces_walls_save; link_arc_spaces_walls_save('/path/to/ARC.ifc', '/path/to/ARC.ttl', '/path/to/linked_spaces_walls.ttl', 0.2)"
python -c "from scripts.ttl_ifc_geom_link import link_mep_components_save; link_mep_components_save('/path/to/HVAC_IFC', '/path/to/HVAC_TTL', '/path/to/Linkset', 0.05)"
```

### Sensor linking

```bash
python -c "from scripts.ttl_sensor_link import define_sensor_instances, link_sensors_to_bot, print_summary_report, save_graph_to_file; g=define_sensor_instances(['/path/to/sensors1.json']); g,stats=link_sensors_to_bot(g, '/path/to/ARC.ttl'); print_summary_report(stats); save_graph_to_file(g, '/path/to/sensors_linked.ttl')"
```

## Recommended End-to-End Order

1. Convert IFC to TTL - `scripts/ifc_lbd_converter.py`, or the HTTP API's `/api/pipeline/convert/ifc-to-ttl`
2. Fix TTL encoding - `utils/encoding_utils.py`
3. Build skeleton links - `scripts/ttl_skeleton_link.py`
4. Build system/terminal links - `scripts/ttl_ifc_system_link.py`
5. Build geometry links - `scripts/ttl_ifc_geom_link.py`
6. Build sensor links - `scripts/ttl_sensor_link.py`
7. Upload the base and linkset TTLs into the project's Fuseki dataset through the main app (`packages/storage/rdf-store`'s `DatasetService`) - this module doesn't talk to Fuseki itself

## Notes

- The linking scripts are function libraries with hardcoded sample paths in their `if __name__ == "__main__"` blocks where present - prefer calling their public functions directly, as shown above.
- This module has no Fuseki client and no SPARQL query capability of its own (`db/fuseki_client.py` and the endpoints that used it were removed) - all Fuseki reads/writes for a project happen through the main app's backend.
- There is no frontend in this module - the 3D/graph viewing UI lives in `modules/app/frontend`'s digital twin page.
