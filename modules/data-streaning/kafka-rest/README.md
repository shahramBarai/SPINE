# Kafka REST API Service

A REST API service for managing Kafka topics and cluster operations.

## Features

- Create, list, and delete Kafka topics
- View topic metadata and configurations
- Get cluster information
- List and view consumer groups
- Health check endpoint
- Swagger API documentation

## API Endpoints

### Health
- `GET /api/v1/health` - Health check endpoint

### Topics
- `GET /api/v1/topics` - List all topics
- `POST /api/v1/topics` - Create a new topic
- `DELETE /api/v1/topics/:topic` - Delete a topic
- `POST /api/v1/topics/metadata` - Get topic metadata
- `GET /api/v1/topics/:topic/config` - Get topic configuration

### Cluster
- `GET /api/v1/cluster` - Get cluster information
- `GET /api/v1/consumer-groups` - List consumer groups
- `GET /api/v1/consumer-groups/:groupId` - Get consumer group details

## Development

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm dev

# Build for production
pnpm build

# Run tests
pnpm test

# Run linter
pnpm lint
```

## Environment Variables

See `.env.example` for required environment variables.

## API Documentation

Swagger UI is available at `http://localhost:3002/docs` when the service is running.