# Timescale Writer

A high-throughput service for writing sensor data from Kafka streams directly to TimescaleDB. This service operates as part of the Storage Module, providing optimized ingestion of time-series data without going through the Data Service API layer.

## Purpose

The Timescale Writer serves as a specialized ingestion pipeline that:

- Consumes sensor data from Kafka topics
- Writes directly to TimescaleDB for optimal performance
- Handles high-frequency data streams efficiently
- Provides dedicated write path for time-series data

## Architecture

```
Kafka Topics → Timescale Writer → TimescaleDB
    ↓              ↓                ↓
Sensor Data → Batch Processing → Hypertables
```

This service bypasses the Data Service for write operations to achieve maximum throughput for sensor data ingestion, while read operations continue to use the centralized Data Service API.

## Key Features

- **High-Throughput Ingestion**: Optimized for writing large volumes of sensor data
- **Kafka Integration**: Native KafkaJS consumer for reliable message processing
- **Batch Processing**: Efficient bulk inserts to TimescaleDB
- **Error Handling**: Robust error handling and retry mechanisms
- **Lightweight**: Minimal overhead Node.js service

## Configuration

The service is configured via environment variables:

```env
# Kafka Configuration
KAFKA_BROKERS=kafka:9092
KAFKA_TOPICS=smartlab-sensor-data

# TimescaleDB Configuration
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=myllypuro-campus
POSTGRES_HOST=timescaledb
POSTGRES_PORT=5433

# Service Configuration
NODE_ENV=development
```

## Development

1. **Install dependencies:**

    ```bash
    npm install
    ```

2. **Start development server:**

    ```bash
    npm run dev
    ```

3. **Production start:**
    ```bash
    npm start
    ```

## Dependencies

- **KafkaJS**: Kafka client for Node.js
- **Sequelize**: ORM for PostgreSQL/TimescaleDB
- **dotenv**: Environment variable management

## Integration

This service integrates with:

- **Messaging Module**: Consumes sensor data from Kafka topics
- **TimescaleDB**: Direct write access for optimal performance
- **Data Service**: Coordinates schema and metadata (read-only)

The service is designed to run alongside the Data Service, handling the high-throughput write workload while the Data Service provides comprehensive read access and metadata management.

---

**Note**: This service writes directly to TimescaleDB for performance reasons. All read operations and metadata management should still go through the Data Service to maintain consistency and security.
