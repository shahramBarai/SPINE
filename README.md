# IoT Platform with Multi-level Digital Twins

Sensor-data platform designed to support multi-level digital twins at Metropolia University of Applied Sciences. The platform focuses on real-time and historical data handling, complex event processing, and simplified data outputs to enable advanced analytics and maintainable system architectures.

## 1. Development Setup

### 1.1 Run the services locally with Docker Compose

1. Start the infrastructure services with `docker compose --profile infra up -d`
   - This will start databases and the Kafka broker.
2. Start the connector services with `docker compose --profile connectors up -d`
   - This will start the MQTT subscriber and the Timescale writer services.

### 1.2 Run the services in a development container

This project uses VS Code's Remote Development with Containers for a consistent development environment.

#### 1.2.1 Prerequisites

1. [Docker](https://www.docker.com/products/docker-desktop)
2. [Visual Studio Code](https://code.visualstudio.com/)
3. [Remote Development extension pack for VS Code](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.vscode-remote-extensionpack)

#### 1.2.2 Opening the Project in a Dev Container

1. Clone this repository
2. Open the project folder in VS Code
3. When prompted "Reopen in Container", click "Yes"
   - Or press F1, type "Remote-Containers: Reopen in Container"

VS Code will build the dev container and connect to it. This process may take a few minutes the first time.

#### 1.2.3 Development Workflow

- The code for all services is mounted into the container, so any changes you make are immediately reflected
- Both Python and Rust IntelliSense, code navigation, and debugging should work seamlessly
- You can run the services using the VS Code terminal with `docker-compose up`
- To add new Python packages, update the appropriate requirements.txt file and rebuild the container
- To add new Rust dependencies, update the Cargo.toml file and rebuild the container

## 2. Project Structure

```
.
├── .devcontainer/            # Dev container configuration
├── databases/
│   ├── timescaledb/          # TimescaleDB database
├── services/
│   ├── mqtt_subscriber/      # MQTT subscriber service (Rust)
│   ├── timescale-writer/     # Timescale writer service (Node.js)
├── docker-compose.yml        # Docker Compose file
```

### 2.1 Kafka

Kafka is a main component of the platform. It is used as a message broker to connect the services together. It is deployed in containerized environment ([docker-compose.yml](./docker-compose.yml) -> `kafka` service).

### 2.2 Databases

#### 2.2.1 TimescaleDB

The TimescaleDB database is a PostgreSQL extension that adds time-series capabilities to the database. It is used to store sensor data.

The database is initialized with the [init_timescaledb.sql](./databases/timescaledb/init_timescaledb.sql) script and it is deployed in containerized environment ([docker-compose.yml](./docker-compose.yml) -> `timescaledb` service).

### 2.3 Services

#### 2.3.1 MQTT Subscriber

The [MQTT subscriber](./services/mqtt_subscriber) service connects to an MQTT broker and listens for messages on specified topics. It is implemented in Rust to provide better performance, memory efficiency and low latency. It performs the following functions:

- Connects to an MQTT broker to consume messages related to sensor data.
- Validates the incoming sensor data, ensuring that timestamps are correctly formatted.
- Inserts valid sensor data into the `sensor_data` table in TimescaleDB.
- Provides a REST API endpoint to manage service configuration (e.g. MQTT topic subscriptions, health checks, etc.).

#### 2.3.2 Timescale Writer

The [Timescale writer](./services/timescale-writer) service is responsible for writing sensor data received from Kafka into a TimescaleDB database. It performs the following functions:

- Connects to a Kafka broker to consume messages related to sensor data.
- Validates the incoming sensor data, ensuring that timestamps are correctly formatted.
- Inserts valid sensor data into the `sensor_data` table in TimescaleDB.
