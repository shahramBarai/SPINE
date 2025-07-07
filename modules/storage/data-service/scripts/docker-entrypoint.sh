#!/bin/sh

# Set default values if environment variables are not provided
POSTGRES_HOST=${POSTGRES_HOST:-postgres}
POSTGRES_PORT=${POSTGRES_PORT:-5432}
TIMESCALE_HOST=${TIMESCALE_HOST:-timescaledb}
TIMESCALE_PORT=${TIMESCALE_PORT:-5432}

echo "🔄 Waiting for Platform PostgreSQL to be ready at ${POSTGRES_HOST}:${POSTGRES_PORT}..."
while ! nc -z "${POSTGRES_HOST}" "${POSTGRES_PORT}"; do
  sleep 1
done
echo "✅ Platform PostgreSQL is ready!"

echo "🔄 Waiting for TimescaleDB to be ready at ${TIMESCALE_HOST}:${TIMESCALE_PORT}..."
while ! nc -z "${TIMESCALE_HOST}" "${TIMESCALE_PORT}"; do
  sleep 1
done
echo "✅ TimescaleDB is ready!"

echo "🛠️  Running Prisma DB push and generate..."
# Initialize Platform DB
pnpm run db:init

# Initialize TimescaleDB and create hypertables
pnpm run db-timescale:init

echo "✅ Database initialization complete!"

# Execute the main command (CMD from Dockerfile)
exec "$@" 