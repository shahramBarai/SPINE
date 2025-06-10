# Data Service

A centralized data access layer that serves as the unified entry point for all non-streaming data operations in the IoT platform. This service implements the **Storage Module's** centralized access pattern, providing secure, validated access to platform metadata, time-series sensor data, and file storage.

## Service Overview

The Data Service acts as a secure gateway between platform components and the underlying storage systems:

- **PostgreSQL**: Platform metadata, user accounts, schemas, configurations
- **TimescaleDB**: High-frequency sensor data and time-series analytics
- **MinIO**: Binary assets, exports, and computational artifacts

## Project Structure

```
src/
├── db/                     # Database connections
├── services/               # Service layer (by database type)
│   ├── platformDB/         # PostgreSQL business logic
│   ├── timescaleDB/        # TimescaleDB operations
│   └── minIO/              # MinIO file operations
├── routes/                 # API routes (organized by backend)
│   ├── platform/           # Platform metadata endpoints
│   ├── timescale/          # Time-series data endpoints
│   └── minio/              # File storage endpoints
└── server.ts              # Main application entry point
```

## API Access Points

- **Platform API**: `http://localhost:3010/api/platform` - Metadata and configuration
- **TimescaleDB API**: `http://localhost:3010/api/timescale` - Sensor data and analytics
- **Storage API**: `http://localhost:3010/api/storage` - File operations
- **Health Check**: `http://localhost:3010/health` - Service status
- **API Info**: `http://localhost:3010/api` - API documentation

## Architecture

The Data Service implements a layered architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                    DataService API                          │
│                 (Centralized Access Layer)                  │
├─────────────────────────────────────────────────────────────┤
│  Platform API     │  TimescaleDB API  │   Storage API       │
│  /api/platform    │  /api/timescale   │   /api/storage      │
├─────────────────────────────────────────────────────────────┤
│  PostgreSQL       │  TimescaleDB      │   MinIO             │
│  (Platform Data)  │  (Sensor Data)    │   (File Storage)    │
│  • Users          │  • Sensor readings│   • Binary assets   │
│  • Projects       │  • Time-series    │   • Exported data   │
│  • Schemas        │  • Analytics      │   • Archives        │
│  • Connectors     │  • Aggregations   │   • Job artifacts   │
└─────────────────────────────────────────────────────────────┘
```

## Key Features

- **🔒 Centralized Access Control**: All storage operations routed through secure API
- **📊 Multi-Database Support**: Optimized access patterns for different data types
- **🔄 Service Layer Architecture**: Clean separation of business logic from database concerns
- **⚡ High-Performance Time-Series**: TimescaleDB optimization for sensor data workloads
- **📁 S3-Compatible Storage**: Cloud-ready file storage with local deployment
- **🛡️ Type Safety**: Full TypeScript support with generated Prisma schemas
- **🏥 Health Monitoring**: Built-in service status and database connectivity checks

## Quick Start

1. **Install dependencies:**

   ```bash
   pnpm install
   ```

2. **Configure environment:**

   ```bash
   cp .env.example .env
   # Edit .env with your database configurations
   ```

3. **Initialize databases:**

   ```bash
   # Platform database (PostgreSQL)
   pnpm db:init

   # Time-series database (TimescaleDB)
   pnpm db-timescale:init
   ```

4. **Start development server:**

   ```bash
   pnpm dev
   ```

5. **Verify service health:**
   ```bash
   curl http://localhost:3010/health
   ```

## Environment Configuration

```env
# Server Configuration
PORT=3010
HOST=0.0.0.0

# PostgreSQL (Platform Database)
DATABASE_URL_PLATFORM="postgresql://user:password@localhost:5432/platform"

# TimescaleDB (Sensor Database)
DATABASE_URL_TIMESCALE="postgresql://user:password@localhost:5432/timescale"

# MinIO Configuration
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
```

## Development Commands

- **Development**: `pnpm dev` - Start with hot reload
- **Production**: `pnpm prod` - Production build and start
- **Type Check**: `pnpm type-check` - Verify TypeScript compilation
- **Linting**: `pnpm lint` - Code quality checks
- **Database Studio**: `pnpm db:studio` or `pnpm db-timescale:studio`

## Security

The service implements comprehensive security measures:

- **Authentication**: Session-based token validation
- **Authorization**: Role-based access control with project-level permissions
- **Validation**: Schema validation for all input data
- **Audit Logging**: Complete operation tracking for governance compliance
- **Encryption**: TLS for all database connections, configurable at-rest encryption

## Integration

This service integrates with other platform modules:

- **Ingress Module**: Receives processed sensor data via Kafka
- **Analytics Module**: Provides data for Flink pipeline processing
- **Application Module**: Serves data to web interfaces and external APIs
- **Messaging Module**: Coordinates with Kafka for event-driven operations

---

**Note**: This service implements a centralized access pattern. No internal or external service should directly access the storage backends—all operations must be routed through this DataService to ensure consistency, security, and governance.
