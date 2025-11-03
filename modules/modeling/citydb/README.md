# 3DCityDB Services

This directory contains all configuration and data related to 3DCityDB services for 3D city modeling.

## Table of contents:

1. [📂 Directory Structure](#1-📂-directory-structure)
2. [📢 Services Overview](#2-📢-services-overview)
3. [📦 Importing and Exporting Data](#3-📦-importing-and-exporting-data)
4. [💾 Data Persistence](#4-💾-data-persistence)
5. [🔗 Accessing Services](#5-🔗-accessing-services)
6. [💿 Backup and Restore](#6-💿-backup-and-restore)
7. [🔧 Maintenance](#7-🔧-maintenance)
8. [📚 References](#8-📚-references)

## 1. 📂 Directory Structure

```
citydb/
├── impexp-data/    # Import/export files (CityGML)
├── .env.example    # Environment variables template
├── .gitignore      # Git ignore rules
└── README.md       # This file
```

## 2. 📢 Services Overview

### CityDB Database
- **Image**: `3dcitydb/3dcitydb-pg:5.0.0-alpine`
- **Container**: `citydb`
- **Port**: `5432` (configurable via `CITYDB_PORT` env var)
- **Purpose**: PostgreSQL-based 3DCityDB database for storing 3D city models
- **Data Persistence**: Docker volume `citydb_data`

### Impexp (Importer/Exporter)
- **Image**: `3dcitydb/impexp:5.5.2`
- **Container**: `citydb-impexp`
- **Purpose**: Command-line tool for importing/exporting CityGML files
- **Data Directory**: `./impexp-data` (mounted at `/data` in container)

### Web Client
- **Image**: `tumgis/3dcitydb-web-map`
- **Container**: `citydb-web-client`
- **Port**: `8081` (configurable via `WEB_CLIENT_PORT` env var)
- **Purpose**: Web interface for visualizing 3D city models
- **Access**: http://localhost:8081

### Web Feature Service (WFS)
- **Image**: `3dcitydb/wfs:5.0.0-alpine`
- **Container**: `citydb-wfs`
- **Port**: `8080` (configurable via `WFS_PORT` env var)
- **Purpose**: OGC Web Feature Service for programmatic access to CityDB data
- **Access**: http://localhost:8080


## 3. 📦 Importing and Exporting Data

### Import CityGML Files

1. **Place CityGML files** in `./impexp-data/` directory

2. **Run import command**:
   ```bash
   cd ..
   docker-compose run --rm impexp ImporterCLI \
     -h citydb \
     -d ${CITYDB_DB} \
     -u ${CITYDB_USER} \
     -p ${CITYDB_PASSWORD} \
     -f /data/your-file.gml
   ```

### Export Data from Database

Export to CityGML format:
```bash
docker-compose run --rm impexp ExporterCLI \
  -h citydb \
  -d ${CITYDB_DB} \
  -u ${CITYDB_USER} \
  -p ${CITYDB_PASSWORD} \
  -o /data/export.gml
```

The exported file will be saved to `./impexp-data/export.gml` on your host machine.

**Important**: Files placed in `./impexp-data` are **NOT automatically imported**. You must manually run import commands.

## 4. 💾 Data Persistence

- **Database data**: Persisted in Docker volume `citydb_data`, survives container restarts
- **Import/Export files**: Stored in `./impexp-data` directory (bind mount)
- **Config files**: Stored in `./configs` directory (optional, not mounted by default)

## 5. 🔗 Accessing Services

### Web Client
- **URL**: http://localhost:8081 (or configured port)
- **Reads directly from**: CityDB database
- No static file volume required

### Web Feature Service (WFS)
- **Base URL**: http://localhost:8080 (or configured port)
- **GetCapabilities**: http://localhost:8080/wfs?service=WFS&version=2.0.0&request=GetCapabilities
- **GetFeature example**: http://localhost:8080/wfs?service=WFS&version=2.0.0&request=GetFeature&typeNames=core:Building

### Database Direct Access
- **Host**: `localhost` (or `citydb` from within Docker network)
- **Port**: `5432` (or configured port)
- **Database**: Configured via `CITYDB_DB` env var (default: `citydb`)
- **User**: Configured via `CITYDB_USER` env var
- **Password**: Configured via `CITYDB_PASSWORD` env var

## 6. 💿 Backup and Restore

### Backup Database

```bash
# Backup to file
docker-compose exec citydb pg_dump -U ${CITYDB_USER} ${CITYDB_DB} > backup.sql

# Or backup the volume directly
docker run --rm -v modeling_citydb_data:/data -v $(pwd):/backup alpine tar czf /backup/citydb-backup.tar.gz /data
```

### Restore Database

```bash
# Restore from SQL dump
docker-compose exec -T citydb psql -U ${CITYDB_USER} ${CITYDB_DB} < backup.sql

# Or restore volume
docker run --rm -v modeling_citydb_data:/data -v $(pwd):/backup alpine tar xzf /backup/citydb-backup.tar.gz -C /
```

## 7. 🔧 Maintenance

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f citydb
docker-compose logs -f impexp
docker-compose logs -f citydb-web-client
docker-compose logs -f citydb-wfs
```

### Restart Services
```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart citydb
```

### Stop and Clean
```bash
# Stop services (keeps data)
docker-compose down

# Stop and remove volumes (⚠️ DELETES ALL DATA)
docker-compose down -v
```

## 8. 📚 References

- [3DCityDB Documentation](https://3dcitydb-docs.readthedocs.io/)
- [3DCityDB Docker Images](https://3dcitydb-docs.readthedocs.io/en/latest/first-steps/docker.html)
- [CityGML Specification](https://www.ogc.org/standards/citygml)
- [OGC WFS Standard](https://www.ogc.org/standards/wfs)

