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

Check [Architecture Guide](./docs/architecture.md) for more details.

## 3. Quick Start

### Prerequisites

- Docker & Docker Compose (v2.20+) ([link](https://docs.docker.com/compose/install/))
- [Node.js 20+](https://nodejs.org/en/download) with [pnpm](https://pnpm.io/installation#using-other-package-managers)
- [Git](https://git-scm.com/downloads)

### Installation

Clone the repository:

```bash
git clone https://github.com/shahramBarai/SPINE.git
cd SPINE
```


## 4. Development Setup

### Using Dev Container

SPINE includes VS Code Dev Container configuration for a consistent development environment.

****Note:** Currently, it runs the [webapp](./modules/app/webapp) service and the core modules [messaging](./modules/messaging) and [storage](./modules/storage) to get you started.

1. Install [VS Code](https://code.visualstudio.com/) and [Remote Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
2. Open the project in VS Code
3. Click "Reopen in Container" when prompted (or press `Ctrl+Shift+P` and type `Remote-Containers: Reopen in Container` then select it).

After the container is built (it will take a few minutes), you need to run the following command to start the services:

```bash
# Install dependencies
pnpm install

# Generate Prisma clients
pnpm db:generate 

# Start the webapp service
pnpm dev
```

You can then access the webapp at `http://localhost:3000`.

### Manual Development Setup

1. **Using Docker Compose:**
You can also run each module separately using Docker Compose (check module's README for more details) or using the profiles in the `docker-compose.yml` file.

    ```bash
    # Core modules (messaging, storage)
    docker compose up -d
    
    # Core + ingress
    docker compose --profile ingress up -d

    # Core + analytics
    docker compose --profile analytics up -d

    # Core + app
    docker compose --profile app up -d

    # Core + egress
    docker compose --profile egress up -d

    # Full platform
    docker compose --profile full up -d

    # You can also combine profiles (e.g. core + ingress + analytics)
    docker compose --profile ingress --profile analytics up -d
    ```

2. **Running Specific Service Locally:** Also, you can run specific service locally if you want to test it (check service's README file for more details).




## 5. Documentation

- [Architecture Guide](./docs/architecture.md)
- [API Reference](./docs/api.md)
- [Deployment Guide](./docs/deployment.md)
- [Contributing Guidelines](./CONTRIBUTING.md)

## 6. Performance

SPINE is designed for high-throughput, low-latency operations:

- **Ingestion**: 100K+ messages/second per node
- **Storage**: Automatic time-based partitioning
- **Query Performance**: Sub-second for recent data
- **Horizontal Scaling**: All components support clustering

## 7. Contributing

Contributions are welcome! Please read our [Contributing Guidelines](./CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Run linting and tests
6. Submit a pull request

## 8. License

This project is licensed under the Apache License 2.0 - see the [LICENSE](./LICENSE) file for details.

This project was developed in Metropolia AMK, Finland as part of the RADIAL project sponsored by ERDF and the Helsinki-Uusimaa Regional Council. See the [NOTICE](./NOTICE) file for additional information.

## 9. Acknowledgments

- Metropolia University of Applied Sciences for supporting this project
- The open-source community for the amazing tools and libraries

Built with ❤️ for the IoT community
