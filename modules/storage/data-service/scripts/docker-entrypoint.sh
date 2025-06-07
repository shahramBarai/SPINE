#!/bin/sh

echo "🔄 Waiting for Platform PostgreSQL to be ready..."
while ! nc -z postgres 5432; do
  sleep 1
done
echo "✅ Platform PostgreSQL is ready!"

echo "🔄 Waiting for TimescaleDB to be ready..."
while ! nc -z timescaledb 5433; do
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