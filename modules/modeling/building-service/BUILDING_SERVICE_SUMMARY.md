# Building Service Summary

## 1. What this part of SPINE does

The Building Service is the modeling pipeline that turns IFC files into linked RDF/Turtle (TTL) and generates cross-model linksets.

At a high level, it does two things:

1. Converts IFC to LBD-style TTL.
2. Enriches and links entities across architecture and MEP TTLs.

It exposes the conversion step over HTTP (FastAPI) for the SPINE backend to call; it does not upload to or query Fuseki itself - that happens through the main app's `packages/storage/rdf-store`.

Primary scripts are listed in this directory's `README.md` and implemented under `src/`.

## 2. Main libraries and runtime components

### Core Python libraries (from src/requirements.txt)

- ifcopenshell: IFC parsing and geometry extraction
- rdflib: RDF graph creation, parsing, querying, and serialization
- shapely: 2D geometric operations (intersections, buffering, adjacency checks)
- rtree: spatial indexing for faster geometry neighborhood search
- trimesh: 3D mesh distance/collision checks for MEP connectivity
- numpy: geometry/math helper operations
- ftfy: text/encoding cleanup support

### Service/API

- fastapi + uvicorn: HTTP API layer (`server.py`, `routers/`)
- python-multipart: file upload support

There is no TimescaleDB or Kafka client in this module anymore - the sensor-data and real-time paths that used to integrate with them here were removed; that integration now lives on the TS backend / ingress side of SPINE.

### External tools/services

- IFCtoLBD Java CLI JAR (`src/java_files/IFCtoLBD_CLI.jar`): actual IFC -> TTL conversion engine
  https://github.com/jyrkioraskari/IFCtoLBD/releases
- Apache Jena Fuseki: RDF store and SPARQL endpoint - written to and queried by the main app, not by this module

## 3. Ontologies and namespaces used

Defined centrally in `src/scripts/graph_manager.py` and reused across linkers:

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

Two independent implementations of the same underlying Java call:

- `src/scripts/ifc_lbd_converter.py` - standalone CLI (single file or batch directory mode)
- `src/conversion/ifc_to_lbd.py` - the HTTP API's version, adding in-memory background job tracking, called from `src/routers/pipeline.py`

### Conversion behavior

- IFC files are converted by running Java with the IFCtoLBD JAR.
- Default options are level=1 and ifcOWL=False.
- Single file and batch directory modes are supported by the CLI script.

### Encoding fix

`src/utils/encoding_utils.py` fixes Finnish-letter encoding issues (mojibake, Latin-1, Java-escaped) in the generated TTL files.

## 5. How extra linkings are created across TTLs

The service creates multiple linkset TTLs, each focused on a different semantic layer.

## 5.1 Skeleton linking (architecture <-> MEP skeleton)

Script: `src/scripts/ttl_skeleton_link.py`

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

Script: `src/scripts/ttl_ifc_system_link.py`

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

Script: `src/scripts/ttl_ifc_geom_link.py`

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

Script: `src/scripts/ttl_sensor_link.py`

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

## 6. HTTP API layer

- `src/server.py` builds the FastAPI app and registers `src/routers/*.py`.
- `src/routers/health.py` - `GET /api/health`, a bare liveness check (no dependency pings).
- `src/routers/pipeline.py` - upload/download files and run conversions in the background, backed by `src/conversion/ifc_to_lbd.py`'s in-memory job tracker.

This module does not query or upload to Fuseki, and has no SPARQL endpoint of its own - a project's TTL is loaded and queried through the main app's `packages/storage/rdf-store` (`DatasetService` for loading, `SemanticSearchService` for querying), driven from the backend's job-execution flow via `BuildingServiceClient`.

## 7. End-to-end process summary

Typical practical process for one dataset:

1. Upload/prepare IFC files (architecture + MEP), via the HTTP API or directly on disk for the CLI scripts.
2. Convert IFC -> TTL using IFCtoLBD (ifcOWL disabled by default in current scripts).
3. Normalize TTL encoding.
4. Generate linksets:
   - skeleton links
   - system/component-space links
   - geometry adjacency links
   - sensor-space links
5. Load the base TTLs and linkset TTLs into Fuseki through the main app (not this module).
6. Query via the main app's SPARQL/tRPC layer for the digital twin viewer and analytics.

## 8. Notes on current implementation state

- Some scripts are production-oriented utilities; the linking scripts in particular are function libraries with hardcoded sample paths in their `main` blocks, meant to be called via their public functions (see the README's usage examples) rather than run as-is.
- `src/utils/sparql_helpers.py` is currently unused - it was written for the FastAPI graph/triple endpoints that lived under the now-removed `services/` and `routers/dataset.py`/`routers/sersors.py`, and nothing in the module calls it anymore.
- `src/requirements.txt` still lists `asyncpg`, `aiokafka`, and `httpx` from the removed TimescaleDB/Kafka/Fuseki clients; none are imported anywhere in the current codebase.
- The summary above reflects the implemented behavior in current Python scripts under `modules/modeling/building-service/src`.
