# SPINE - Stream Processing Infrastructure for Nested Environments

**Engine for Digital Twins** - A modular, event-driven platform for real-time sensor data integration and stream processing in smart environments.

SPINE is a production-ready IoT platform designed to handle complex sensor data integration, real-time stream processing, and multi-level digital twin deployments.

## 1. Key Features

- **Event-Driven Architecture** - Built on Apache Kafka for reliable, scalable message streaming
- **Real-Time Stream Processing** - Apache Flink integration for complex event processing and analytics
- **Multi-Protocol Support** - MQTT, HTTP/REST, WebSocket ingestion interfaces
- **Time-Series Optimization** - TimescaleDB for efficient sensor data storage and queries
- **Modular Microservices** - Domain-driven design with independently scalable components
- **Schema Management** - Confluent Schema Registry for data governance and evolution
- **Visual Pipeline Builder** - Drag-and-drop interface for creating data processing workflows
- **Multi-Tenant Architecture** - Project-based isolation with role-based access control

## 2. Architecture Overview

SPINE follows a modular, microservices architecture with clear separation of concerns:

![Architecture Overview](./docs/images/architecture-overview-modules.jpg)

### Core Modules

- **Ingress**: High-performance data collection (Rust/Tokio)
- **Messaging**: Apache Kafka 7.5.0 with Schema Registry
- **Storage**: Dual-database architecture (PostgreSQL + TimescaleDB)
- **Analytics**: Apache Flink for stream processing
- **Application**: Next.js 15 web interface with tRPC
- **Egress**: API gateway and data export services

## 3. Quick Start

### Prerequisites

- Docker & Docker Compose (v2.20+)
- Node.js 20+ with pnpm
- Git

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/your-org/spine.git
cd spine
```

2. **Configure environment**

```bash
cp .env.example .env
# Edit .env with your configuration
```

## 4. Development Setup

### Using Dev Containers (Recommended)

SPINE includes VS Code Dev Container configuration for a consistent development environment:

1. Install [VS Code](https://code.visualstudio.com/) and [Remote Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
2. Open the project in VS Code
3. Click "Reopen in Container" when prompted

### Manual Development Setup

````bash
# Install dependencies
pnpm install

# Generate Prisma clients
pnpm turbo db:generate

# Start development servers
pnpm turbo dev  # In each service directory

## 5. Configuration

### Docker Compose Profiles

```bash
# Core infrastructure (databases, Kafka, MinIO)
docker compose --profile infra up -d

# Data connectors and ingestion
docker compose --profile connectors up -d

# Stream processing and analytics
docker compose --profile analytics up -d

# Complete platform
docker compose --profile full up -d
````

## 5. Documentation

- [Architecture Guide](./docs/architecture.md)
- [API Reference](./docs/api.md)
- [Deployment Guide](./docs/deployment.md)
- [Contributing Guidelines](./CONTRIBUTING.md)

## 6. Security

- **Authentication**: JWT-based with iron-session
- **Authorization**: Role-based access control (RBAC)
- **Data Validation**: Schema validation at ingestion
- **Network Security**: TLS/SSL for all connections
- **Secrets Management**: Environment-based configuration

## 7. Performance

SPINE is designed for high-throughput, low-latency operations:

- **Ingestion**: 100K+ messages/second per node
- **Storage**: Automatic time-based partitioning
- **Query Performance**: Sub-second for recent data
- **Horizontal Scaling**: All components support clustering

## 8. Contributing

Contributions are welcome! Please read our [Contributing Guidelines](./CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Run linting and tests
6. Submit a pull request

## 9. License

This project is licensed under the Apache License 2.0 - see the [LICENSE](./LICENSE) file for details.

This project was developed in Metropolia AMK, Finland as part of the RADIAL project sponsored by ERDF and the Helsinki-Uusimaa Regional Council. See the [NOTICE](./NOTICE) file for additional information.

## 10. Acknowledgments

- Metropolia University of Applied Sciences for supporting this project
- The open-source community for the amazing tools and libraries

Built with ❤️ for the IoT community
