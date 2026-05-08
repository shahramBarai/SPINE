# DevContainer Setup for Multi-Language Development

This DevContainer provides a complete development environment for the IoT Platform, supporting multiple programming languages used across different modules.

## Usage

1. Open VS Code or Cursor
2. Open the project folder
3. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac) and select "Dev Containers: Reopen in Container"
4. Wait for the container to build and start
5. The terminal will open in `/workspace`

### Working with Different Modules

**Node.js/TypeScript modules** (e.g., `modules/app/webapp`):

```bash
cd modules/app/webapp
pnpm install
pnpm dev
```

**Rust modules** (e.g., `modules/ingress/mqtt_subscriber`):

```bash
cd modules/ingress/mqtt_subscriber
cargo build
cargo run
```

**Python modules** (e.g., `modules/analytics/flink-cep`):

```bash
cd modules/analytics/flink-cep
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Features

### Multi-Language Support

- **Node.js 20** with TypeScript support
    - pnpm package manager pre-installed
    - For modules: app/webapp, storage/data-service, storage/timescale-writer, ingress/mqtt_subscriber_nodejs, analytics/job-submission-service

- **Rust** (latest stable)
    - rustup, cargo, rustfmt, clippy
    - For modules: ingress/mqtt_subscriber

- **Python 3** with pip and venv
    - For modules: analytics/flink-cep

### Development Tools

- VS Code extensions for:
    - TypeScript/JavaScript: ESLint, Prettier, Tailwind CSS, Prisma
    - Rust: rust-analyzer, TOML support
    - Python: Python, Pylance, Black formatter
    - General: GitLens, REST Client, Copilot

### Infrastructure Integration

- Connection to external Docker services (PostgreSQL, TimescaleDB, MinIO, Kafka)
- Port forwarding for Next.js dev server (3000) and Node.js debugging (9229)

## Network Configuration

The DevContainer connects to the `iot-platform-network` which is created by the main docker-compose.yml. This allows the web app to communicate with:

- Data Service on `data-service:3010`
- PostgreSQL on `postgres:5432`
- TimescaleDB on `timescaledb:5432`
- MinIO on `minio:9000`
- Kafka on `kafka:9092`

## Environment Variables

The following environment variables are pre-configured:

- `DATA_SERVICE_URL`: Data service connection string (http://data-service:3010)
- `DATABASE_URL`: PostgreSQL connection string
- `TIMESCALE_URL`: TimescaleDB connection string
- `MINIO_*`: MinIO credentials
- `NODE_ENV`: Set to "development"
- `NEXT_TELEMETRY_DISABLED`: Disables Next.js telemetry

## Troubleshooting

If you encounter connection issues:

1. Ensure infrastructure services are running: `docker compose ps`
2. Check the network exists: `docker network ls | grep iot-platform-network`
3. Rebuild the container: "Dev Containers: Rebuild Container"
