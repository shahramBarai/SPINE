# Storage Module

The Storage Module provides centralized, secure, and scalable data persistence for the IoT platform. This module implements a **multi-database architecture** with specialized backends, unified through a centralized access layer that enforces consistent security, validation, and governance.

## Module Concept

The Storage Module addresses the challenge of managing diverse data types in IoT environments by implementing a **domain-separated architecture**:

- **Platform Metadata**: User accounts, configurations, schemas (PostgreSQL)
- **Time-Series Data**: High-frequency sensor readings (TimescaleDB)
- **File Storage**: Binary assets, exports, archives (MinIO)

Each storage backend is optimized for its specific data type and access patterns, while a unified API layer provides consistent access control and data governance.

## Services Overview

- **[Data Service](data-service/)** - Centralized API gateway providing secure access to all storage backends
- **[Timescale Writer](timescale-writer/)** - High-throughput ingestion service for sensor data streams

## Architecture Overview

### Multi-Database Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    DataService Layer                        │
│                 (Unified Access Control)                    │
├─────────────────────────────────────────────────────────────┤
│     PostgreSQL      │     TimescaleDB     │      MinIO      │
│  (Platform Data)    │   (Sensor Data)     │  (File Storage) │
│                     │                     │                 │
│ • Strong ACID       │ • Time-series       │ • S3 Compatible │
│ • Referential       │   Optimization      │ • Cloud Ready   │
│   Integration       │ • Horizontal        │ • Versioning    │
│ • Complex Queries   │   Partitioning      │ • Lifecycle     │
│ • Schema Evolution  │ • Compression       │   Management    │
└─────────────────────────────────────────────────────────────┘
```

### Centralized Access Pattern

All storage operations flow through the Data Service, providing:

```
External Client → API Gateway → DataService → Service Layer → Database
                     ↓              ↓           ↓
                  Auth Check → Permission → Validation → Audit Log
```

## Key Design Principles

- **Domain Separation**: Each database optimized for its specific use case
- **Performance Isolation**: Time-series writes don't impact metadata queries
- **Centralized Security**: Unified authentication and authorization
- **Scaling Independence**: Each backend scales based on its workload characteristics
- **Cloud Portability**: S3-compatible storage enables cloud migration

## Quick Start

1. **Start storage infrastructure:**

   ```bash
   docker-compose -f docker-compose.storage.yml up -d
   ```

2. **Verify services:**

   ```bash
   # Check Data Service health
   curl http://localhost:3010/health
   ```

3. **Access APIs:**
   - **Data Service**: http://localhost:3010/api
   - **Health Check**: http://localhost:3010/health

## Integration with Platform

The Storage Module integrates with other platform modules through:

- **Event-Driven Architecture**: Kafka integration for real-time data flows
- **REST APIs**: Secure access for web applications and external clients
- **Schema Registry**: Central data contract management
- **Audit Logging**: Complete operation tracking for governance

This modular approach enables independent scaling, technology optimization, and operational flexibility while maintaining consistent data governance across the entire platform.

## Troubleshooting

### Database Authentication Errors

If you encounter authentication errors like "password authentication failed for user postgres", this usually means the database volumes contain old data with different passwords.

#### Solution 1: Reset Database Passwords (Recommended for existing data)
```bash
# Reset passwords to match docker-compose configuration
docker exec -it postgres psql -U postgres -c "ALTER USER postgres PASSWORD 'postgres';"
docker exec -it timescaledb psql -U postgres -c "ALTER USER postgres PASSWORD 'postgres';"

# Restart data-service
docker restart data-service
```

#### Solution 2: Clean Volumes (WARNING: Deletes all data)
```bash
# Stop all services
docker compose down

# Remove database volumes
docker volume rm iot-platform-multilevel-digital-twins_postgres_data
docker volume rm iot-platform-multilevel-digital-twins_timescaledb_data

# Start services again (databases will be initialized fresh)
docker compose up -d
```

### Common Issues

1. **Port conflicts**: Ensure ports 5432, 5433, and 3010 are not in use
2. **Memory issues**: TimescaleDB requires adequate memory for efficient operation
3. **Connection timeouts**: Health checks ensure databases are ready before data-service starts
