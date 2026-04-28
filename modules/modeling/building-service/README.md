# Modeling Module - Building Service

The Building Service in the Modeling module provides IFC-to-TTL conversion and RDF link generation for SPINE building models.

This README is aligned with the current scripts in src. Files starting with WIP are temporary notebook work and are intentionally excluded.

## Purpose

- Convert IFC files into Linked Building Data (TTL)
- Normalize TTL encoding issues
- Generate linksets for skeleton, system, geometry, and sensor relations

## Current Script Inventory

Stable scripts currently used:

- ifc_lbd_converter.py: IFC to TTL conversion using IFCtoLBD Java CLI
- encoding_utils.py: detects and fixes encoding issues in TTL files
- ttl_skeleton_link.py: links architecture and MEP skeleton entities (site, building, storey)
- ttl_ifc_system_link.py: adds IFC system instances and links terminals/components to spaces
- ttl_ifc_geom_link.py: computes adjacency links (space-space, space-wall, MEP component connectivity)
- ttl_sensor_link.py: creates sensor instances from JSON and links sensors to BOT spaces
- ifc_ttl_fuseki_pipeline.py: converts IFC, fixes TTL encoding, then uploads corrected TTL to Fuseki
- ttl_fuseki_manager.py: loads, deletes, and updates TTL data in Apache Jena Fuseki
- fuseki_sparql_client.py: queries Fuseki using SPARQL SELECT, CONSTRUCT, ASK with domain-specific helpers
- graph_manager.py: RDF namespace setup and graph save helpers

Temporary files not part of final repository:

- WIP_*.ipynb notebooks

## Directory Structure

```
modules/modeling/building-service/
├── README.md
└── src/
	├── config.json
	├── requirements.txt
	├── jar/
	│   └── IFCtoLBD_CLI_2_44_4.jar
	├── graph_manager.py
	├── ifc_lbd_converter.py
	├── encoding_utils.py
	├── ttl_skeleton_link.py
	├── ttl_ifc_system_link.py
	├── ttl_ifc_geom_link.py
	├── ttl_sensor_link.py
	├── ifc_ttl_fuseki_pipeline.py
	├── ttl_fuseki_manager.py
	├── fuseki_sparql_client.py
	└── WIP_*.ipynb (temporary)
```

## Prerequisites

- Python 3.10+
- Java (required by ifc_lbd_converter.py)
- Native deps for ifcopenshell/shapely/rtree/trimesh as needed by your platform

Install Python dependencies:

```powershell
cd modules/modeling/building-service/src
pip install -r requirements.txt
```

## Configuration

Conversion settings are read from src/config.json:

- hardware: Java JVM flags
- ifc2lbd.jar_file: path to IFCtoLBD CLI jar
- ifc2lbd.level: conversion level
- ifc2lbd.ifcOWL: whether to include ifcOWL output

## Running Scripts

Run commands from modules/modeling/building-service/src.

### 1) IFC to TTL conversion

Single IFC file:

```powershell
python ifc_lbd_converter.py -f "C:\path\to\model.ifc"
```

Batch directory mode:

```powershell
python ifc_lbd_converter.py -d "C:\path\to\IFC"
```

Use dedicated pipeline script for database upload after encoding correction.

Notes:

- The converter auto-creates a TTL directory that mirrors the IFC folder structure.
- Only .ifc files are processed in directory mode.

### 2) Encoding normalization for TTL files

encoding_utils.py currently exposes functions, not a CLI parser. Use it via Python import:

```powershell
python -c "from encoding_utils import process_path; process_path(r'C:\path\to\TTL')"
```

You can also run deep audit for one file:

```powershell
python -c "from encoding_utils import check_fin_letter_encoding; check_fin_letter_encoding(r'C:\path\to\file.ttl')"
```

### 3) Skeleton linking (site/building/storey)

ttl_skeleton_link.py is function-driven with dataset paths in its main block.

Recommended usage pattern:

```powershell
python -c "from ttl_skeleton_link import link_folder_skeletons; link_folder_skeletons(r'C:\path\to\ARC.ttl', r'C:\path\to\MEP_TTL_FOLDER', r'C:\path\to\output_linkset.ttl')"
```

### 4) System and terminal-to-space linking

ttl_ifc_system_link.py is function-driven. Use link_mep_system_ttl:

```powershell
python -c "from ttl_ifc_system_link import link_mep_system_ttl; link_mep_system_ttl(r'C:\path\to\MEP_IFC_FOLDER', r'C:\path\to\MEP_TTL_FOLDER', r'C:\path\to\ARC.ifc', r'C:\path\to\ARC.ttl', ['IfcFlowTerminal','IfcFlowController','IfcDistributionControlElement','IfcEnergyConversionDevice','IfcFlowMovingDevice','IfcFlowStorageDevice','IfcFlowTreatmentDevice','IfcBuildingElementProxy'], r'C:\path\to\linked_systems_elements.ttl')"
```

### 5) Geometry-based linking

ttl_ifc_geom_link.py provides two main entry functions:

- link_arc_spaces_walls_save(arc_ifc_path, arc_ttl_path, save_path, tolerance)
- link_mep_components_save(mep_ifc_folder, mep_ttl_folder, save_folder, tolerance)

Examples:

```powershell
python -c "from ttl_ifc_geom_link import link_arc_spaces_walls_save; link_arc_spaces_walls_save(r'C:\path\to\ARC.ifc', r'C:\path\to\ARC.ttl', r'C:\path\to\linked_spaces_walls.ttl', 0.2)"
```

```powershell
python -c "from ttl_ifc_geom_link import link_mep_components_save; link_mep_components_save(r'C:\path\to\HVAC_IFC', r'C:\path\to\HVAC_TTL', r'C:\path\to\Linkset', 0.05)"
```

### 6) Sensor linking

ttl_sensor_link.py is function-driven. Typical sequence:

1. define_sensor_instances(json_files)
2. link_sensors_to_bot(sensor_graph, arc_ttl)
3. print_summary_report(stats)
4. save_graph_to_file(graph, output_file)

Example:

```powershell
python -c "from ttl_sensor_link import define_sensor_instances, link_sensors_to_bot, print_summary_report, save_graph_to_file; g=define_sensor_instances([r'C:\path\to\sensors1.json', r'C:\path\to\sensors2.json']); g,stats=link_sensors_to_bot(g, r'C:\path\to\ARC.ttl'); print_summary_report(stats); save_graph_to_file(g, r'C:\path\to\sensors_linked.ttl')"
```

### 7) IFC -> Encoding Fix -> Fuseki pipeline

This script guarantees upload happens after encoding checks/fixes:

```powershell
python ifc_ttl_fuseki_pipeline.py -d "C:\path\to\IFC" --fuseki-base-url "http://localhost:3030" --fuseki-dataset "dataset"
```

If Fuseki authentication is enabled, provide credentials (or set env vars FUSEKI_USERNAME/FUSEKI_PASSWORD):

```powershell
python ifc_ttl_fuseki_pipeline.py -d "C:\path\to\IFC" --fuseki-dataset "spine" --fuseki-username "admin" --fuseki-password "admin123" --fuseki-timeout 600
```

Named graph replacement with one graph per file stem:

```powershell
python ifc_ttl_fuseki_pipeline.py -d "C:\path\to\IFC" --fuseki-dataset "dataset" --fuseki-graph-template "http://example.org/graph/{stem}" --fuseki-replace
```

### 8) Direct Fuseki TTL management

Load (append) TTL into Fuseki:

```powershell
python ttl_fuseki_manager.py load --ttl "C:\path\to\file.ttl" --dataset "dataset" --username "admin" --password "admin123"
```

Update (replace) named graph with TTL:

```powershell
python ttl_fuseki_manager.py update --ttl "C:\path\to\file.ttl" --dataset "dataset" --graph "http://example.org/graph/building1" --username "admin" --password "admin123"
```

Delete default or named graph data:

```powershell
python ttl_fuseki_manager.py delete --dataset "dataset"
python ttl_fuseki_manager.py delete --dataset "dataset" --graph "http://example.org/graph/building1"
```

### 9) Query building data with SPARQL

fuseki_sparql_client.py provides both raw SPARQL execution and domain-specific query helpers.

Query all buildings:

```powershell
python -c "from fuseki_sparql_client import FusekiSparqlClient; c=FusekiSparqlClient(); print(c.get_buildings())"
```

Query all spaces in a building:

```powershell
python -c "from fuseki_sparql_client import FusekiSparqlClient; c=FusekiSparqlClient(); spaces=c.get_spaces(building_uri='http://example.org/building1'); print(spaces)"
```

Query adjacent spaces:

```powershell
python -c "from fuseki_sparql_client import FusekiSparqlClient; c=FusekiSparqlClient(); adj=c.get_space_adjacencies('http://example.org/space1'); print(adj)"
```

Query all systems in a building:

```powershell
python -c "from fuseki_sparql_client import FusekiSparqlClient; c=FusekiSparqlClient(); sys=c.get_systems(building_uri='http://example.org/building1'); print(sys)"
```

Query components within a system:

```powershell
python -c "from fuseki_sparql_client import FusekiSparqlClient; c=FusekiSparqlClient(); comp=c.get_system_components('http://example.org/system1'); print(comp)"
```

Query all sensors:

```powershell
python -c "from fuseki_sparql_client import FusekiSparqlClient; c=FusekiSparqlClient(); sensors=c.get_sensors(); print(sensors)"
```

Query sensors in a specific space:

```powershell
python -c "from fuseki_sparql_client import FusekiSparqlClient; c=FusekiSparqlClient(); sensors=c.get_sensors(space_uri='http://example.org/space1'); print(sensors)"
```

Query all points in a space:

```powershell
python -c "from fuseki_sparql_client import FusekiSparqlClient; c=FusekiSparqlClient(); pts=c.get_space_points('http://example.org/space1'); print(pts)"
```

Count entities of a type:

```powershell
python -c "from fuseki_sparql_client import FusekiSparqlClient; c=FusekiSparqlClient(); n=c.count_entities('https://w3id.org/bot#Space'); print(f'Total spaces: {n}')"
```

Get all properties of an entity:

```powershell
python -c "from fuseki_sparql_client import FusekiSparqlClient; c=FusekiSparqlClient(); props=c.get_entity_properties('http://example.org/space1'); print(props)"
```

Execute custom SPARQL SELECT:

```powershell
python -c "from fuseki_sparql_client import FusekiSparqlClient; c=FusekiSparqlClient(); results=c.select_query('SELECT ?s WHERE { ?s a <https://w3id.org/bot#Space> } LIMIT 10'); print(results)"
```

Execute custom SPARQL CONSTRUCT (returns RDF graph):

```powershell
python -c "from fuseki_sparql_client import FusekiSparqlClient; c=FusekiSparqlClient(); g=c.construct_query('CONSTRUCT { ?s ?p ?o } WHERE { ?s a <https://w3id.org/bot#Building> . ?s ?p ?o }'); g.serialize(destination='output.ttl', format='turtle')"
```


## Recommended End-to-End Order

1. Convert IFC to TTL with ifc_lbd_converter.py
2. Fix TTL encoding with encoding_utils.py
3. Upload corrected TTL to Fuseki with ifc_ttl_fuseki_pipeline.py (or ttl_fuseki_manager.py for direct TTL operations)
4. Build skeleton links with ttl_skeleton_link.py
5. Build system/terminal links with ttl_ifc_system_link.py
6. Build geometry links with ttl_ifc_geom_link.py
7. Build sensor links with ttl_sensor_link.py
8. Query linked data with fuseki_sparql_client.py


## Notes

- Most linking scripts are currently configured as function libraries with hardcoded sample paths in their main blocks.
- For reproducible runs, prefer calling their public functions (shown above) with explicit paths.

