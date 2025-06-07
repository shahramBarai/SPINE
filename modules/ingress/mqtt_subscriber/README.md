# MQTT Subscriber Service

A Rust-based MQTT subscriber service that manages MQTT topic subscriptions via a REST API and forwards messages to Kafka for further processing.

## Features

- RESTful API for managing MQTT topic subscriptions
- On-demand MQTT connection management
- Kafka integration with robust connection handling
- Swagger UI for API documentation and testing
- Asynchronous message processing
- Robust error handling and reconnection logic
- Time-windowed metrics collection system
- Snappy compression for Kafka messages

## Project Structure

```
src/
├── api/              # API layer
│   ├── handlers.rs   # API endpoint handlers
│   ├── models.rs     # API data models
│   └── routes.rs     # API route setup
├── kafka/            # Kafka integration
│   └── producer.rs   # Kafka producer with reconnection logic
├── metrics/          # Metrics collection system
│   ├── mod.rs        # Module exports and constants
│   ├── message_metrics.rs  # Main metrics aggregation
│   ├── ring_buffer.rs      # Time window data structure
│   └── windowed.rs         # Per-window metrics collection
├── mqtt/             # MQTT functionality
│   └── subscriber.rs # Main subscriber logic
├── processor/        # Message processing
│   └── handler.rs    # Message handling logic
├── config.rs         # Configuration handling
├── models.rs         # Shared data models
└── main.rs           # Application entry point
```

## Kafka Integration

The service includes a robust Kafka integration with the following features:

- **Resilient connection handling**: Automatic reconnection with exponential backoff
- **Topic-specific producers**: Dedicated methods for sensor data and service metrics
- **Compression**: Uses Snappy compression to reduce bandwidth usage
- **Health monitoring**: Background health checks to detect connection issues
- **Error handling**: Graceful handling of Kafka outages

### Kafka Producer Features

- **Connection management**: Automatic reconnection with exponential backoff
- **Topic validation**: Ensures topics exist before sending messages
- **Metrics integration**: Tracks message delivery status for accurate metrics
- **Extensible design**: Prepared for future enhancements like Protobuf serialization

## Metrics System

The service includes a sophisticated metrics collection system with the following characteristics:

- **Time-windowed metrics**: Metrics are collected in 1-minute windows
- **Stable reporting**: Only completed windows are included in metrics reporting, ensuring stable, consistent values
- **Memory efficient**: Fixed memory usage regardless of message volume or service uptime
- **Low overhead**: Metrics collection adds minimal processing overhead

### Available Metrics

| Metric                       | Description                                                 |
| ---------------------------- | ----------------------------------------------------------- |
| `messages_received`          | Total number of messages received in completed windows      |
| `messages_processed`         | Total number of messages successfully processed             |
| `messages_dropped`           | Number of messages that couldn't be delivered to Kafka      |
| `processing_errors`          | Count of errors encountered during processing               |
| `throughput`                 | Messages per second (calculated from completed window data) |
| `average_message_size`       | Mean size of received messages in bytes                     |
| `max_message_size`           | Size of the largest message seen                            |
| `average_processing_time_ms` | Mean time to process a message (milliseconds)               |
| `max_processing_time_ms`     | Maximum time any message took to process                    |
| `last_message_time`          | Timestamp of the most recently received message             |

### Metrics Window Behavior

- Current activity (last ~0-60 seconds) is collected but not included in API responses
- Only completed 1-minute windows are reported in metrics
- This approach ensures consistent metric values that don't fluctuate wildly during high activity
- Trade-off: Metrics may lag real-time activity by up to one minute

## Configuration

Configuration is handled through environment variables:

```
# MQTT Settings
MQTT_BROKER=xrdevmqtt.edu.metropolia.fi
MQTT_PORT=1883
MQTT_CLIENT_ID=mqtt-subscriber
MQTT_USERNAME=
MQTT_PASSWORD=
MQTT_QOS=0
MQTT_KEEP_ALIVE=30

# Kafka Settings
KAFKA_BROKER=localhost:9094
KAFKA_TOPIC_SENSOR_DATA=smartlab-sensor-data
KAFKA_TOPIC_SERVICE_METRICS=smartlab-subscriber-metrics

# API Settings
API_PORT=3000

# Logging
RUST_LOG=info
```

## API Endpoints

- `GET /health` - Health check endpoint (includes MQTT and Kafka connection status)
- `GET /topics` - List all subscribed topics
- `GET /metrics` - Get service metrics (from the last completed window)
- `POST /subscribe` - Subscribe to a new topic
- `DELETE /unsubscribe/{topic}` - Unsubscribe from a topic

Documentation is available at `/docs` when the service is running.

## Running the Service

```bash
cargo run
```

The API will be available at http://localhost:3000 with documentation at http://localhost:3000/docs/

## Deployment Considerations

### Kafka Configuration

For production deployments:

- Ensure Kafka topics exist before starting the service
- Consider increasing the number of partitions for high-throughput topics
- Adjust producer settings for your environment's reliability/throughput needs

### Handling Kafka Outages

The service is designed to handle Kafka outages:

- It will continue processing MQTT messages
- Messages will be marked as "dropped" when Kafka is unavailable
- Metrics will track the impact of Kafka outages
- The service will automatically try to reconnect to Kafka

For production workloads with zero message loss requirements, consider:

- Implementing a local storage buffer for messages when Kafka is down
- Adding retry logic to replay failed messages when Kafka reconnects
- Using a more robust monitoring solution to alert on Kafka connectivity issues

### Log Rotation

For long-running deployments, configure log rotation to prevent disk space issues. For example, with systemd:

```
[Service]
# ...other settings...
StandardOutput=journal
StandardError=journal
```

Or with a logging system like logrotate.

### Metrics Integration

The service can easily be integrated with monitoring systems:

- **Prometheus**: Add a metrics exporter endpoint in the `/metrics` format
- **InfluxDB**: Send metrics at regular intervals for time-series analysis
- **Grafana**: Create dashboards using any of the above data sources

For high-throughput deployments, consider adjusting the metrics window size:

```rust
// In src/metrics/mod.rs
pub const WINDOW_DURATION: Duration = Duration::from_secs(60); // Default: 1 minute
pub const NUM_WINDOWS: usize = 1; // Default: 1 window
```

### Future Extensions

The metrics system and Kafka integration are designed to be extensible:

- Add protobuf serialization for structured message formats
- Implement message schema validation and enforcement
- Add topic-specific metrics breakdowns
- Implement message replay and recovery mechanisms
- Create advanced routing rules based on message content
