# SPINE - Stream Processing Infrastructure for Nested Environments

**Engine for Digital Twins** - A modular, event-driven platform for real-time sensor data integration and stream processing in smart environments.

SPINE is a production-ready IoT platform designed to handle complex sensor data integration, real-time stream processing, and multi-level digital twin deployments.

## ✨ Key Features

- **Event-Driven Architecture** - Built on Apache Kafka for reliable, scalable message streaming
- **Real-Time Stream Processing** - Apache Flink integration for complex event processing and analytics
- **Multi-Protocol Support** - MQTT, HTTP/REST, WebSocket ingestion interfaces
- **Time-Series Optimization** - TimescaleDB for efficient sensor data storage and queries
- **Modular Microservices** - Domain-driven design with independently scalable components
- **Schema Management** - Confluent Schema Registry for data governance and evolution
- **Visual Pipeline Builder** - Drag-and-drop interface for creating data processing workflows
- **Multi-Tenant Architecture** - Project-based isolation with role-based access control

## 🏗️ Architecture Overview

SPINE follows a modular, microservices architecture with clear separation of concerns:

![Architecture Overview](./docs/images/architecture-overview-modules.jpg)

### Core Modules

- **Ingress**: High-performance data collection (Rust/Tokio)
- **Messaging**: Apache Kafka 7.5.0 with Schema Registry
- **Storage**: Dual-database architecture (PostgreSQL + TimescaleDB)
- **Analytics**: Apache Flink for stream processing
- **Application**: Next.js 15 web interface with tRPC
- **Egress**: API gateway and data export services

Check [🏗️ Architecture Guide](./docs/architecture.md) for more details.

## 🚀 Quick Start

**Prerequisites:**

- Docker & Docker Compose (v2.20+) ([link](https://docs.docker.com/compose/install/))
- [Node.js 20+](https://nodejs.org/en/download) with [pnpm](https://pnpm.io/installation#using-other-package-managers)
- [Git](https://git-scm.com/downloads)


To run the platform, you can use the following commands:

```bash
# Clone the repository
git clone https://github.com/shahramBarai/SPINE.git
# Navigate to the project directory
cd SPINE
# Start the platform with all services
docker compose --profile full up -d
# Stop the platform
docker compose --profile full down
```

For more information about how to run the platform, check [📚 Developer Guide](./docs/developer_guide.md).

## 👨‍💻 Contributing

Contributions are welcome! Please read our [👨‍💻 Contributing Guidelines](./docs/contributing/README.md) for details.

## 📜 Code of Conduct

Respect and constructive communication are our core values. Please take a moment to read through our [📜 Code of Conduct](./docs/code_of_conduct.md) to ensure a positive environment for everyone.

## ⚖️ License

This project is licensed under the Apache License 2.0 - see the [LICENSE](./LICENSE) file for details.

This project was developed in Metropolia AMK, Finland as part of the RADIAL project sponsored by ERDF and the Helsinki-Uusimaa Regional Council. See the [NOTICE](./NOTICE) file for additional information.

## 🙏 Acknowledgments

- Metropolia University of Applied Sciences for supporting this project
- The open-source community for the amazing tools and libraries

Built with ❤️ for the IoT community
