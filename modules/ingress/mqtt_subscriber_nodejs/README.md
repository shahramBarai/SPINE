# MQTT Subscriber Service (Node.js)

A robust Node.js-based MQTT subscriber service that provides real-time message ingestion from MQTT brokers and forwards processed data to Kafka for further pipeline processing. This service features advanced schema validation, automatic error handling, and comprehensive health monitoring.

## Features

- **Real-time MQTT Subscription**: Dynamic topic subscription management with automatic reconnection
- **Schema Registry Integration**: Advanced Avro schema validation with Schema Registry compatibility checking
- **Kafka Integration**: Reliable message forwarding to Kafka with robust error handling
- **Health Monitoring**: Comprehensive health checks for MQTT, Kafka, and Schema Registry connections
- **Zod-based Validation**: Runtime schema validation using Zod for TypeScript type safety
- **Fastify API**: High-performance REST API with automatic JSON schema generation
- **Graceful Shutdown**: Proper resource cleanup and connection management
- **Comprehensive Logging**: Structured logging with configurable levels and formatting

## Project Structure

```
src/
├── services/                   # Core service implementations
│   ├── index.ts                    # Service exports and initialization
│   ├── KafkaProducerService.ts     # Kafka producer with connection management
│   ├── MQTTService.ts              # MQTT client with retry logic and message handling
│   └── SchemaRegistryService.ts    # Schema Registry integration and validation
├── routes/                     # API route handlers
│   └── health.ts                   # Health check endpoint
├── utils/                      # Utility functions and configurations
│   ├── config.ts                   # Environment configuration management
│   ├── logger.ts                   # Structured logging setup
│   └── zodSchemaValidator.ts       # Avro to Zod schema conversion
├── examples/                   # Usage examples and validation samples
├── deps.ts                     # Service dependency injection
└── index.ts                    # Main application entry point
```

## Architecture

The service implements a clean layered architecture with clear separation of concerns:

```
┌──────────────────────────────────────────────────────────────┐
│                    Fastify REST API                          │
│                 (Health Checks & Status)                     │
├──────────────────────────────────────────────────────────────┤
│  MQTT Service      │  Kafka Producer     │  Schema Registry  │
│  • Connection mgmt │  • Message routing  │  • Validation     │
│  • Retry logic     │  • Error handling   │  • Compatibility  │
│  • Topic subs      │  • Health checks    │  • Zod conversion │
├──────────────────────────────────────────────────────────────┤
│  MQTT Broker       │  Kafka Cluster      │  Schema Registry  │
│  (Message Source)  │  (Downstream)       │  (Validation)     │
└──────────────────────────────────────────────────────────────┘
```

## Schema Validation

The service implements a sophisticated schema validation system:

- **Schema Registry Integration**: Real-time schema fetching and compatibility checking
- **Avro to Zod Conversion**: Automatic conversion of Avro schemas to Zod validation schemas
- **Runtime Validation**: Message validation against registered schemas before Kafka forwarding
- **Type Safety**: Full TypeScript support with generated types from schemas
- **Version Management**: Support for schema evolution and backward compatibility

### Validation Flow

1. **Schema Fetching**: Retrieve latest schema from Schema Registry
2. **Conversion**: Convert Avro schema to Zod validation schema
3. **Validation**: Validate incoming MQTT messages against schema
4. **Forwarding**: Send validated messages to Kafka topics
5. **Error Handling**: Route invalid messages to Dead Letter Queues

## Configuration

Configuration is managed through environment variables, check the [.env.example](.env.example) file for more details.

## API Endpoints

- `GET /` - Service information and status
- `GET /health` - Comprehensive health check

### Health Check Response

```json
{
  "status": "healthy|degraded|unhealthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "services": {
    "mqtt": {
      "isConnected": true,
      "reconnectAttempts": 0,
      "lastConnectedAt": "2024-01-01T11:55:00.000Z"
    },
    "kafka": {
      "isConnected": true,
      "topic": "mqtt-data",
      "partitionCount": 3
    },
    "schema": {
      "isConnected": true,
      "schemaId": 123,
      "version": 2,
      "compatibility": "FULL"
    }
  }
}
```

## Quick Start

1. **Install dependencies:**

   ```bash
   pnpm install
   ```

2. **Configure environment:**

   ```bash
   cp .env.example .env
   # Edit .env with your broker configurations
   ```

3. **Start development server:**

   ```bash
   pnpm run dev
   ```

4. **Verify service health:**

   ```bash
   curl http://localhost:3000/health
   ```

## Future Enhancements

- **Dynamic Topic Management**: REST API for runtime topic subscription
- **Multiple Schema Support**: Support for multiple schema subjects
- **Message Transformation**: Built-in message transformation capabilities
- **Batch Processing**: Support for batch message processing
- **Retry Queues**: Dead letter queue management with retry logic