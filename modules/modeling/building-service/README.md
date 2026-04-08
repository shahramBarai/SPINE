# Modeling Module - Building Service

The Building Service part in the Modeling module provides Building Information Modeling (BIM) with Linked Building Data services for the SPINE platform. This module enables storage, management, visualization, and processing of semantic and 3D data of buildings.

## Table of contents:
1. [🎯 Purpose](#1-🎯-purpose)
2. [📂 Directory Structure](#2-📂-directory-structure)
3. [🚀 Quick Start](#3-🚀-quick-start)
4. [🏃 Running the Module](#4-🏃-running-the-module)
5. [🔧 Configuration](#5-🔧-configuration)
6. [➕ Adding New Services](#6-➕-adding-new-services)
7. [📦 Integration](#7-📦-integration)
8. [🐛 Troubleshooting](#8-🐛-troubleshooting)
9. [🔒 Security](#9-🔒-security)
10. [📄 License](#10-📄-license)

## 1. 🎯 Purpose

The Modeling module serves as a container for BIM-related services that support:
- **Building Information Modeling**: Integration and processing of openBIM data (IFC)
- **Semantic Data Services**: Provision of semantic data through standardized interfaces
- **Data Visualization**: Web-based interfaces for viewing and exploring building models

## 2. 📂 Directory Structure

```
/your-repo
│
│
├── src/                # The backend scripts
│   ├── graph_manager.py    # Namespace init, saving, loading
│   ├── encoding_utils.py   # Fixing Finnish letters (ä, ö, etc.)
│   ├── ifc_lbd_converter.py    # Java CLI wrapper for IFC2LBD converter
│   ├── 02_skeleton_gen.py  # Creating the IFC skeleton
│   ├── 03_enrichment.py    # Semantic enrichment logic
│   ├── 04_system_mapper.py # IFCSystem instances & linking
│   └── 05_sensor_map.py    # Sensor metadata conversion
│
├── .gitignore              # Ignoring the /data folder
├── requirements.txt        # Python dependenciesmodeling/
├── docker-compose.yml  # Docker Compose file for all services
└── README.md           # This file
```

Each service directory (`citydb/`, etc.) contains:
- Service-specific configuration
- Data directories (if needed)
- Documentation in `README.md`

## 3. 🚀 Quick Start

ifc_lbd_converter to convert ifc to ttl files.
encoding_utils to fix Finnish letters in ttl files.



