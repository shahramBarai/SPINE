# Modeling Module

The Modeling module provides Building Information Modeling (BIM) and 3D city modeling services for the SPINE platform. This module enables storage, management, visualization, and processing of 3D spatial data and building models.

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
- **3D City Modeling**: Storage and management of 3D city models and spatial data
- **Building Information Modeling**: Integration and processing of BIM data
- **Spatial Data Services**: Provision of geospatial data through standardized interfaces
- **Data Visualization**: Web-based interfaces for viewing and exploring 3D models

## 2. 📂 Directory Structure

```
modeling/
├── citydb/             # 3DCityDB service implementation
├── .env.example        # Environment variables template
├── .gitignore          # Git ignore rules
├── docker-compose.yml  # Docker Compose file for all services
└── README.md           # This file
```

Each service directory (`citydb/`, etc.) contains:
- Service-specific configuration
- Data directories (if needed)
- Documentation in `README.md`

## 3. 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose installed
- Ports available: 8080 (WFS), 8081 (web client) - or configured in the [docker-compose.yml](./docker-compose.yml) file.

### Setup

1. **Start Services**

   ```bash
   # Start all services
   docker-compose up -d

   # Verify services are running
   docker-compose ps

   # View logs
   docker-compose logs -f
   ```

2. **Access Services**

   - **Web Client**: http://localhost:8081 (or configured port)
   - **WFS Service**: http://localhost:8080 (or configured port)

## 4. 🏃 Running the Module

### Start All Services

```bash
docker-compose up -d
```

Starts all configured modeling services.

### Start Specific Services

```bash
# Database only
docker-compose up -d citydb

# Database + specific service
docker-compose up -d citydb citydb-web-client
```

### Stop Services

```bash
# Stop all services (preserves data)
docker-compose down

# Stop and remove volumes (⚠️ WARNING: Deletes all data)
docker-compose down -v
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f citydb
```

### Restart Services

```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart citydb
```

## 5. 🔧 Configuration

Environment variables control service configuration. The `.env` or `.env.example` file is required. See individual service documentation for detailed configuration options.

Docker Compose will use the `.env` file if it exists, otherwise it will use the `.env.example` file. I.e. if you want to use a different settings and want to keep sensitive information in a separate file, you can create a `.env` file and put the sensitive information in it (.env files are ignored by git).

## 6. ➕ Adding New Services

To add a new BIM-related service to this module:

1. **Create Service Directory**
   ```bash
   mkdir -p new-service
   ```

2. **Add Service to docker-compose.yml**
   ```yaml
   new-service:
     image: your-image:tag
     # ... service configuration
   ```
   or 
   ```yaml
   new-service:
     build:
       context: ./new-service
       dockerfile: Dockerfile
     # ... service configuration
   ```

3. **Create Service Documentation**
   ```bash
   touch new-service/README.md
   ```
   Document service-specific setup, configuration, and usage.

4. **Update This README**
   - Add service to "Current Services" section
   - Update directory structure if needed

## 7. 📦 Integration

The Modeling module integrates with other SPINE platform modules:

**TODO**: Add service-to-service communication details

Service-to-service communication is handled through Docker's internal network when services are started together.

## 8. 🐛 Troubleshooting

### Common Issues

**TODO**: Add issues when they are encountered.

## 9. 🔒 Security

⚠️ **Security Best Practices:**

1. **Credentials**: Always change default passwords in `.env`
2. **Environment Files**: Never commit `.env` to version control
3. **Network**: Restrict exposed ports appropriately for your environment
4. **Updates**: Keep Docker images updated for security patches
5. **Backups**: Implement regular backups for persistent data

For detailed security guidelines, see individual service documentation.

## 10. 📄 License

See main SPINE project license ([link](../LICENSE)).
