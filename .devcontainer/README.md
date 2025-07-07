# DevContainer Setup for Next.js Development

This DevContainer provides a complete development environment for the IoT Platform's Next.js web application.

## Usage

1. Open VS Code or Cursor
2. Open the project folder
3. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac) and select "Dev Containers: Reopen in Container"
4. Wait for the container to build and start
5. The terminal will open in `/workspace`
6. Navigate to the webapp and start development:
   ```bash
   cd modules/app/webapp
   pnpm dev
   ```

## Features

- Node.js 20 with TypeScript support
- pnpm package manager pre-installed
- Automatic dependency installation on container creation
- VS Code extensions for Next.js, TypeScript, ESLint, Prettier, and Tailwind CSS
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
