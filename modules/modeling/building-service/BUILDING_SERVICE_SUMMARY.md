# Building Service Summary

## 1. What this part of SPINE does

The Building Service is the modeling pipeline that turns IFC files into linked RDF/Turtle (TTL), generates cross-model linksets, and exposes query/API access on top of Fuseki.

At a high level, it does three things:

1. Converts IFC to LBD-style TTL.
2. Enriches and links entities across architecture and MEP TTLs.
3. Loads and queries the data through Apache Jena Fuseki (plus FastAPI endpoints for frontend usage).

Primary scripts are listed in `src/README` and implemented under `src/`.

## 2. Main libraries and runtime components

### Core Python libraries (from src/requirements.txt)

- ifcopenshell: IFC parsing and geometry extraction
- rdflib: RDF graph creation, parsing, querying, and serialization
- shapely: 2D geometric operations (intersections, buffering, adjacency checks)
- rtree: spatial indexing for faster geometry neighborhood search
- trimesh: 3D mesh distance/collision checks for MEP connectivity
- numpy: geometry/math helper operations
- ftfy: text/encoding cleanup support

### Service/API and integration

- fastapi + uvicorn: HTTP API layer
- httpx: async HTTP support
- python-multipart: file upload support
- TimescaleDB(TODO): history data retrieving and visualization to be updated.
- Kafka(TODO): real-time data retrieving and visualization to be updated.

### External tools/services

- IFCtoLBD(v 2.44.0) Java CLI JAR: actual IFC -> TTL conversion engine
  https://github.com/jyrkioraskari/IFCtoLBD/releases 
- Apache Jena Fuseki: RDF store and SPARQL endpoint

## 3. Ontologies and namespaces used

Defined centrally in `src/graph_manager.py` and reused across linkers:

- BOT: https://w3id.org/bot#
- Brick: https://brickschema.org/schema/Brick#
- PROPS: http://lbd.arch.rwth-aachen.de/props#
- S223: http://data.ashrae.org/standard223#
- FSO: https://w3id.org/fso#
- OWL/RDFS/RDF: standard semantic web vocabularies
- INST: project instance namespace (https://lbd.example.com/)

Practical role split in this codebase:

- BOT is used for spatial/building topology (Site/Building/Storey/Space and adjacency/containment).
- Brick is used for systems/sensors and part-of relations.
- S223 and FSO are used for MEP network semantics and connectivity topology.
- PROPS is used heavily to resolve IFC GlobalId and property attributes in TTL.

## 4. IFC -> TTL conversion flow

Implemented in `src/ifc_lbd_converter.py`, `src/conversion/ifc_to_lbd.py`, and `src/ifc_ttl_fuseki_pipeline.py`.

### Conversion behavior

- IFC files are converted by running Java with the IFCtoLBD JAR.
- Default options are level=1 and ifcOWL=False.
- Single file and batch directory modes are supported.

### Pipeline order

The pipeline script enforces this sequence per file:

1. Convert IFC to TTL.
2. Run encoding fix on generated TTL.
3. Upload corrected TTL into Fuseki.

This is explicitly described in code as:

- convert -> fix encoding -> upload to Fuseki

### Fuseki loading details

`src/ttl_fuseki_manager.py` uses Graph Store Protocol endpoints:

- POST /data: append triples
- PUT /data: replace graph contents
- DELETE /data: delete graph contents

Supports:

- default graph or named graph URI
- optional graph URI template per file stem
- optional basic auth and timeout settings

## 5. How extra linkings are created across TTLs

The service creates multiple linkset TTLs, each focused on a different semantic layer.

## 5.1 Skeleton linking (architecture <-> MEP skeleton)

Script: `src/ttl_skeleton_link.py`

Goal:

- Align Site, Building, and Storey entities between architecture TTL and each MEP TTL.

How matching works:

- Site/Building:
  - If one-to-one: use owl:sameAs.
  - If architecture has one and engineering has many: use bot:containsZone from architecture to each engineering entity.
- Storey:
  - Matched by elevation using props:elevationIfcBuildingStorey_attribute_simple with +/- 0.5 m tolerance.
  - One match: owl:sameAs.
  - Multiple matches at same elevation: bot:containsZone (architecture storey contains engineering sub-storeys).

Important safeguard:

- If engineering storeys show no meaningful elevation variance, storey matching is skipped to avoid false positives.

## 5.2 System + terminal/component to space linking

Script: `src/ttl_ifc_system_link.py`

Goal:

- Create explicit system instances and connect systems/components/spaces.

What is added:

- From IfcSystem:
  - instance URI under INST namespace
  - rdf:type brick:System
  - rdfs:label, description/globalId properties
  - owl:sameAs link to an ifcSystem instance URI
- From IfcRelAssignsToGroup:
  - system brick:hasPart component

Cross-TTL linking behavior:

- Architecture IFC spaces and MEP IFC components are compared geometrically.
- Components intersecting/aligned with spaces are linked as:
  - space bot:hasElement terminal_or_component

So this script links MEP TTL entities to architecture TTL spaces using IFC geometry as the bridge.

## 5.3 Geometry adjacency linking (space/wall + MEP network topology)

Script: `src/ttl_ifc_geom_link.py`

Two major outputs:

1. Architecture space/wall adjacency.
2. MEP component connectivity and run/chain topology.

### Architecture adjacency

- Space-space adjacency is written as bot:adjacentZone.
- Space-wall adjacency is written as bot:adjacentElement.
- Uses exact 2D footprints generated from IFC meshes (union of triangle faces), with geometric tolerance checks.

### MEP adjacency and chain semantics

- Components are grouped by IfcSystem and checked in 3D.
- R-tree is used for broad-phase neighbor search; Trimesh min distance confirms actual connections.
- Raw physical component adjacency is added as symmetric:
  - fso:connectedWith

Then macro topology is built:

- connected runs represented as brick:Collection
- continuous pass-through segments represented as s223:Connection
- membership modeled with brick:isPartOf and brick:hasPart
- macro adjacency between chain/junction entities modeled as symmetric s223:cnx

This provides both micro-level physical connectivity and macro-level network graph structure.

## 5.4 Sensor linking (JSON metadata -> Brick sensors -> BOT spaces)

Script: `src/ttl_sensor_link.py`

Flow:

1. Read sensor JSON files.
2. Mint sensor URIs in INST namespace.
3. Type sensors via Brick classes (temperature/co2/humidity mapping, fallback to brick:Sensor).
4. Match sensor labels to bot:Space labels in architecture TTL.
5. Link matched sensors to spaces using:
   - brick:isPointOf

Matching strategy:

- Exact case-insensitive label match first.
- Prefix-based fuzzy match as fallback.

## 6. Query and API layer after linking

- `src/db/fuseki_sparql_client.py` provides SELECT/CONSTRUCT/ASK wrappers and domain helpers.
- `src/api_server.py` and `src/api/*.py` expose endpoints for tree/sensors/triples/graph and pipeline operations.
- Fuseki SPARQL endpoint is the main read/query backend.

## 7. Frontend part (`frontend/`)

The `building-service/frontend` app is the operator UI for browsing models, running pipeline actions, and exploring semantic links.

### Frontend stack

- Vite + React + TypeScript
- TanStack React Query for API data fetching and cache invalidation
- Three.js + `web-ifc-three` (`IFCLoader`) for IFC 3D visualization
- UI components from Radix/shadcn patterns

### Main frontend workflow

1. User loads IFC files from the left sidebar into the viewer.
2. Viewer parses IFC files client-side and renders multi-model scenes.
3. Top bar actions trigger backend pipeline operations:
   - Convert to TTL
   - Sync to Fuseki
4. Semantic and graph panels consume data from backend APIs and SPARQL-backed endpoints.

### Key frontend features implemented

- Multi-panel digital twin layout:
  - `TopNav` (actions/status)
  - `LeftSidebar` (project tree, sensors, IFC loading/layers/floor filtering)
  - `ViewerPane` (3D IFC scene, selection, highlighting)
  - `GraphPane` (relationship graph + sensor detail/history)
  - `BottomPanel` (semantic search/table)
- Live mode indicators based on backend health checks (Fuseki/Timescale connectivity).
- IFC model handling with performance safeguards for larger models (loader configuration, geometry optimization, adaptive behavior in viewer code).

### Backend integration behavior

- API base URL is configured via `VITE_BUILDING_API_BASE_URL` (default `http://localhost:8000/api`).
- Data hooks (`use-twin-data`) query backend endpoints for tree, sensors, triples, graph, and health.
- If backend is unavailable, frontend falls back to local mock data (`src/lib/twin-data.ts`).
- In dev mode, API calls can attempt an auto-start route (`/__dev/start-building-api`) and retry after health check.

### Semantic search behavior in frontend

- Frontend can execute semantic search requests and map SPARQL bindings into:
  - triple table rows
  - graph nodes/edges with RDF/BOT/Brick/S223/FSO label normalization

## 8. End-to-end process summary

Typical practical process for one dataset:

1. Upload/prepare IFC files (architecture + MEP).
2. Convert IFC -> TTL using IFCtoLBD (ifcOWL disabled by default in current scripts).
3. Normalize TTL encoding.
4. Generate linksets:
   - skeleton links
   - system/component-space links
   - geometry adjacency links
   - sensor-space links
5. Load base TTLs and linkset TTLs into Fuseki (default or named graphs).
6. Query and serve via SPARQL/FastAPI for frontend and analytics.

## 9. Notes on current implementation state

- Some scripts are production-oriented utilities; some API pipeline endpoints remain partially stubbed/TODO.
- TODO: Data retrieving and visualization via Knowledge Graph nodes.
- TODO: Sync of visualization of selected Knowledge Graph and selected IFC entitiies.
- The summary above reflects the implemented behavior in current Python scripts under `modules/modeling/building-service/src`.
