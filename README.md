# IoT Platform with Multi-level Digital Twins

Sensor-data platform designed to support multi-level digital twins at Metropolia University of Applied Sciences. The platform focuses on real-time and historical data handling, complex event processing, and simplified data outputs to enable advanced analytics and maintainable system architectures.

## Development Setup

This project uses VS Code's Remote Development with Containers for a consistent development environment.

### Prerequisites

1. [Docker](https://www.docker.com/products/docker-desktop)
2. [Visual Studio Code](https://code.visualstudio.com/)
3. [Remote Development extension pack for VS Code](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.vscode-remote-extensionpack)

### Opening the Project in a Dev Container

1. Clone this repository
2. Open the project folder in VS Code
3. When prompted "Reopen in Container", click "Yes"
   - Or press F1, type "Remote-Containers: Reopen in Container"

VS Code will build the dev container and connect to it. This process may take a few minutes the first time.

### Development Workflow

- The code for all services is mounted into the container, so any changes you make are immediately reflected
- Both Python and Rust IntelliSense, code navigation, and debugging should work seamlessly
- You can run the services using the VS Code terminal with `docker-compose up`
- To add new Python packages, update the appropriate requirements.txt file and rebuild the container
- To add new Rust dependencies, update the Cargo.toml file and rebuild the container

## Project Structure

- `/services/mqtt_subscriber/` - MQTT subscription service (Python)
- `/services/mqtt_subscriber_rust/` - MQTT subscription service (Rust)
- (More services to be added)

## Services

### MQTT Subscriber

The MQTT subscriber service connects to an MQTT broker and listens for messages on specified topics. It is implemented in two languages:

#### Python Version

- Located in `/services/mqtt_subscriber/`
- Uses paho-mqtt library

#### Rust Version

- Located in `/services/mqtt_subscriber_rust/`
- Uses rumqttc library
- Provides better performance and memory efficiency

Both versions have the same functionality and can be used interchangeably.
