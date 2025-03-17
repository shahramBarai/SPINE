# MQTT Subscriber Service

A Rust-based MQTT subscriber service that manages MQTT topic subscriptions via a REST API.

## Features

- RESTful API for managing MQTT topic subscriptions
- On-demand MQTT connection management
- Swagger UI for API documentation and testing
- Asynchronous message processing
- Robust error handling and reconnection logic

## Project Structure

- `src/main.rs` - Application entry point and server setup
- `src/config.rs` - Configuration handling
- `src/mqtt.rs` - MQTT connection and event handling
- `src/handlers.rs` - API route handlers
- `src/models.rs` - Data structures and schemas

## Configuration

Configuration is done via environment variables or a `.env` file:

```
# MQTT Connection Settings
MQTT_BROKER=xrdevmqtt.edu.metropolia.fi
MQTT_PORT=1883
MQTT_USERNAME=
MQTT_PASSWORD=
MQTT_QOS=0

#API Settings
API_PORT=3000

# Logging
RUST_LOG=info
```

## API Endpoints

- `GET /health` - Health check endpoint
- `GET /topics` - List all subscribed topics
- `POST /subscribe` - Subscribe to a new topic
- `DELETE /unsubscribe/:topic` - Unsubscribe from a topic

Documentation is available at `/docs` when the service is running.

## Running the Service

```bash
cargo run
```

The API will be available at http://localhost:3000 with documentation at http://localhost:3000/docs/
