# 🏗️ SPINE Architecture

SPINE is a **reference implementation** of a modular, event-driven platform designed to unify heterogeneous sensor data and enable scalable, real-time digital twin ecosystems.
It combines **microservice-based modularity**, **event-driven messaging**, and **containerised deployment** to provide a flexible infrastructure for smart buildings, labs, and campuses.

## Table of Contents

1. [🧰 Design Principles](#design-principles)
2. [🧩 Modular Architecture](#modular-architecture)
3. [🔀 Data Flow Architecture](#data-flow-architecture)
4. [📊 Scalability Considerations](#scalability-considerations)
5. [🔒 Security Architecture](#security-architecture)
6. [🚀 Deployment Architecture](#deployment-architecture)
7. [🔍 Monitoring and Observability](#monitoring-and-observability)
8. [🔮 Future Architectural Considerations](#future-architectural-considerations)

## 1. 🧰 Design Principles

### 1.1 Event-Driven Architecture

SPINE is built around the principle of event-driven communication, using Apache Kafka as the central nervous system. This approach ensures:

- **Decoupling**: Services communicate through events rather than direct calls
- **Scalability**: Each component can scale independently based on load
- **Resilience**: Message persistence and replay capabilities provide fault tolerance
- **Real-time Processing**: Stream processing enables immediate response to sensor data

### 1.2 Microservices Architecture

The platform follows a domain-driven design with clear separation of concerns:

- **Modularity**: Each module has a single responsibility
- **Independence**: Services can be developed, deployed, and scaled independently
- **Technology Diversity**: Different modules can use optimal technologies for their specific needs
- **Fault Isolation**: Failures in one module don't cascade to others

### 1.3 Multi-Tenant Design

SPINE supports multiple projects with complete isolation:

- **Project-based Isolation**: Each tenant operates in their own namespace
- **Role-based Access Control**: Granular permissions for different user types
- **Resource Management**: Fair resource allocation across tenants

## 2. 🧩 Modular Architecture

SPINE is organized into six main modules. Each has its own service-level README with details on APIs, configs, and implementation.

![Modular Architecture](./images/architecture-overview-modules.jpg)

| Module          | Responsibility                                         | Technologies                     | Docs                                                   |
| --------------- | ------------------------------------------------------ | -------------------------------- | ------------------------------------------------------ |
| **Ingress**     | Collects IoT data via MQTT, HTTP, WebSocket            | Rust, Node.js                    | [Ingress README](../modules/ingress/README.md)         |
| **Messaging**   | Event backbone, topic management, schema governance    | Kafka 7.5.0 + Schema Registry    | [Messaging README](../modules/messaging/README.md)     |
| **Storage**     | Persistent metadata & time-series data                 | PostgreSQL + TimescaleDB + MinIO | [Storage README](../modules/storage/README.md)         |
| **Analytics**   | Real-time stream processing and pipeline orchestration | Apache Flink                     | [Analytics README](../modules/analytics/README.md)     |
| **Egress**      | REST/WebSocket APIs for external access                | Node.js (Fastify)                | [Egress README](../modules/egress/README.md)           |
| **Application** | User interface, project management, pipeline builder   | Next.js 15 + tRPC                | [Application README](../modules/application/README.md) |

## 3. 🔀 Data Flow Architecture

| Communication Type       | Technology   | Use Case                      |
| ------------------------ | ------------ | ----------------------------- |
| **Asynchronous Events**  | Apache Kafka | Ingress → Analytics → Storage |
| **Synchronous Requests** | REST / tRPC  | Service APIs & Admin tools    |

Example:

```
IoT Device → Ingress → Kafka → Analytics → Storage → Egress → Application

```

### Flow Summary

- **Ingress** standardizes and publishes validated data into Kafka.
- **Kafka** brokers distribute events to multiple consumers.
- **Analytics (Flink)** subscribes to topics for processing and pattern detection.
- **Storage** persists raw and processed data into TimescaleDB or archives into MinIO.
- **Egress** and **Application** expose data through APIs and live dashboards.

This design enables **parallel processing**, **asynchronous scaling**, and **real-time reactivity** across modules.

## 4. 📊 Scalability Considerations

### Horizontal Scaling

- **Kafka**: Multi-broker clusters with partition-based parallelism
- **Flink**: Multiple task managers with configurable parallelism
- **Ingress**: Multiple instances behind load balancers
- **Storage**: Read replicas and connection pooling

### Vertical Scaling

- **Resource Allocation**: Each module can be allocated specific CPU/memory resources
- **Performance Tuning**: Module-specific optimizations (e.g., Kafka batch sizes, Flink parallelism)

## 5. 🔒 Security Architecture

### Multi-Layer Security

1. **Network Security**: Docker networks with controlled inter-service communication
2. **Authentication**: JWT-based authentication with role-based access control
3. **Data Encryption**: TLS for data in transit, encryption at rest for sensitive data
4. **Schema Validation**: All data validated against schemas before processing

### Tenant Isolation

- **Project-based Namespaces**: Complete data isolation between projects
- **Resource Quotas**: Prevent resource exhaustion by individual tenants
- **Access Control**: Granular permissions for different user roles

## 6. 🚀 Deployment Architecture

### Containerization

- **Docker**: All services containerized for consistent deployment
- **Docker Compose**: Orchestration with environment-specific configurations
- **Profiles**: Flexible service composition (dev, staging, production)

### Environment Configurations

- **Development**: Single-broker Kafka, relaxed settings for faster startup
- **Production**: Multi-broker clusters, security hardening, monitoring

## 7. 🔍 Monitoring and Observability

### Health Checks

- **Service Health**: Each module exposes health endpoints
- **Dependency Monitoring**: Service dependencies are monitored
- **Resource Metrics**: CPU, memory, and network usage tracking

### Logging Strategy

- **Structured Logging**: JSON-formatted logs for easy parsing
- **Centralized Logging**: All logs collected for analysis
- **Log Levels**: Configurable logging levels per environment

## 8. 🔮 Future Architectural Considerations

- Migration to Kubernetes with distributed Kafka clusters (KRaft mode)
- Plugin-based connector system for new IoT protocols (e.g., OPC UA, Modbus)
- Integration with Building Information Models (BIM) and Digital Twin frameworks
- CI/CD automation and environment validation
- Advanced caching and edge-processing extensions
