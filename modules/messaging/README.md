# Messaging Module

This module provides comprehensive Kafka deployment configurations for both development and production environments, with built-in fault tolerance, monitoring, error handling capabilities, and integrated Confluent Schema Registry for schema management.

## 🏗️ Architecture Overview

### Development Environment

- **Single Broker**: Optimized for local development
- **Resource Efficient**: 512MB heap, minimal configuration
- **Explicit Topics**: Auto-topic creation disabled for consistency
- **Schema Registry**: Single instance for schema management
- **Monitoring**: Basic JMX metrics and Kafka UI

### Production Environment

- **Multi-Broker Cluster**: 3 brokers for high availability
- **Fault Tolerance**: Replication factor 3, min ISR 2
- **Load Balancing**: HAProxy for client load distribution
- **Performance Optimized**: 2GB heap, tuned configurations
- **Schema Registry**: Single instance (clustered setup available)
- **Monitoring**: Basic JMX metrics and HAProxy stats

## 📁 Directory Structure

```
modules/messaging/
├── docker-compose.dev.yml          # Development environment
├── docker-compose.prod.yml         # Production environment
├── kafka/
│   ├── configs/
│   │   ├── dev/
│   │   │   └── server.properties    # Development Kafka config
│   │   └── prod/
│   │       ├── server.properties    # Production Kafka config
│   │       └── haproxy.cfg         # Load balancer config
│   └── security/                   # SSL certificates (empty)
├── schema-registry/
│   ├── schemas/
│   │   └── sensor-data.avsc        # IoT sensor data schema
│   └── scripts/                    # Schema management scripts
└── scripts/
    ├── deploy-dev.sh               # Development deployment
    ├── deploy-prod.sh              # Production deployment
    ├── topic-manager.sh            # Topic management utility
    └── schema-manager.sh           # Schema Registry management
```

## 🚀 Quick Start

### Development Environment

```bash
# Deploy development Kafka
docker compose -f docker-compose.dev.yml up -d

# Check deployment status
docker ps --filter name=kafka-dev
docker ps --filter name=schema-registry-dev

# Create IoT platform topics (required - auto-creation is disabled)
./scripts/topic-manager.sh create-iot-topics

# Access Kafka UI
open http://localhost:8080

# Access Schema Registry
curl http://localhost:8081/subjects

# Stop development environment
docker compose -f docker-compose.dev.yml down
```

### Production Environment

```bash
# Deploy production Kafka cluster
docker compose -f docker-compose.prod.yml up -d

# Check deployment status (all 3 brokers should be healthy)
docker ps --filter name=kafka

# Check HAProxy load balancer stats
open http://localhost:8404/stats

# Create production topics (required - auto-creation is disabled)
./scripts/topic-manager.sh -e prod create-iot-topics

# Register Avro schemas
./scripts/schema-manager.sh -e prod register-iot-schemas

# Stop production environment
docker compose -f docker-compose.prod.yml down
```

## ⚠️ Important Configuration Notes

### Recent Updates (2025)

1. **Inter-broker Protocol**: The Docker Compose files have been updated to avoid conflicts between `KAFKA_INTER_BROKER_LISTENER_NAME` and `KAFKA_SECURITY_INTER_BROKER_PROTOCOL`. Only the listener name is now specified.

2. **HAProxy Configuration**: The production HAProxy configuration has been updated to fix permission issues:

   - Removed user/group settings that caused socket permission errors
   - Commented out stats socket configuration
   - Ensured configuration file ends with a newline

3. **Container Naming**: Make sure to clean up any existing containers with conflicting names before deployment:
   ```bash
   # Remove any existing kafka containers
   docker rm -f $(docker ps -a --filter name=kafka -q) 2>/dev/null || true
   # Remove conflicting networks
   docker network rm iot-platform-network 2>/dev/null || true
   ```

## 🔧 Configuration Differences

| Feature             | Development | Production   |
| ------------------- | ----------- | ------------ |
| Brokers             | 1           | 3            |
| Replication Factor  | 1           | 3            |
| Min ISR             | 1           | 2            |
| Heap Size           | 512MB       | 2GB          |
| Auto Topic Creation | Disabled    | Disabled     |
| Log Retention       | 7 days      | 30 days      |
| Compression         | Snappy      | Snappy       |
| Monitoring          | Basic       | Full Stack   |
| Load Balancer       | None        | HAProxy      |
| Schema Registry     | Single      | Clustered    |
| Security            | None        | Configurable |

## 📊 Monitoring & Observability

### Development

- **Kafka UI**: http://localhost:8080
- **Schema Registry**: http://localhost:8081
- **JMX Metrics**: Port 9101
- **Health Check**: Built into containers

### Production

- **HAProxy Stats**: http://localhost:8404/stats
- **Schema Registry**: http://localhost:8081
- **JMX Metrics**: Ports 9101, 9102, 9103
- **Note**: Prometheus, Grafana, and AlertManager are not currently configured

### Key Metrics Monitored

- Broker availability and health
- Topic throughput and latency
- Consumer lag and processing rates
- Error rates and DLQ statistics
- Schema Registry health and usage
- Schema evolution and compatibility
- System resource utilization
- Network and disk I/O

## 📋 Schema Management with Confluent Schema Registry

The Messaging Module integrates Confluent Schema Registry for centralized schema management and evolution. All messages are serialized using Avro schemas registered in the Schema Registry.

### Schema Registry Features

- **Centralized Schema Storage**: All Avro schemas stored in Schema Registry
- **Schema Evolution**: Backward/forward compatibility enforcement
- **Version Management**: Multiple schema versions with compatibility rules
- **Data Serialization**: Avro serialization/deserialization with schema validation
- **Schema Compatibility**: Automatic compatibility checking during evolution

### Application Schema Registration Workflow

Before producing messages to Kafka topics, applications **must** register their Avro schemas:

#### 1. Schema Definition

Create Avro schema files for your messages:

```json
// sensor-data.avsc (actual schema in the project)
{
  "type": "record",
  "name": "SensorData",
  "namespace": "com.iotplatform.messaging",
  "doc": "IoT sensor data schema for the messaging module",
  "fields": [
    {
      "name": "sensor_id",
      "type": "string",
      "doc": "Unique identifier for the sensor"
    },
    {
      "name": "timestamp",
      "type": "long",
      "doc": "Unix timestamp in milliseconds"
    },
    { "name": "value", "type": "double", "doc": "The sensor reading value" },
    { "name": "unit", "type": "string", "doc": "Unit of measurement" },
    {
      "name": "location",
      "type": ["null", "string"],
      "default": null,
      "doc": "Optional location identifier"
    },
    {
      "name": "metadata",
      "type": ["null", { "type": "map", "values": "string" }],
      "default": null,
      "doc": "Optional metadata"
    }
  ]
}
```

#### 2. Schema Registration

Applications must register schemas before first use:

```bash
# Register schema using REST API
curl -X POST -H "Content-Type: application/vnd.schemaregistry.v1+json" \
  --data '{"schema": "{\"type\":\"record\",\"name\":\"SensorData\",\"namespace\":\"com.iotplatform.messaging\",\"fields\":[{\"name\":\"sensor_id\",\"type\":\"string\"},{\"name\":\"timestamp\",\"type\":\"long\"},{\"name\":\"value\",\"type\":\"double\"},{\"name\":\"unit\",\"type\":\"string\"},{\"name\":\"location\",\"type\":[\"null\",\"string\"],\"default\":null}]}"}' \
  http://localhost:8081/subjects/sensor-data-value/versions

# Or use the schema manager script
./scripts/schema-manager.sh register sensor-data ./schemas/sensor-data.avsc
```

#### 3. Producer Configuration

Configure producers to use Avro serialization:

```javascript
// Node.js example
const kafka = require("kafkajs");
const { AvroSerializer } = require("@kafkajs/confluent-schema-registry");

const registry = new SchemaRegistry({ host: "http://localhost:8081" });
const serializer = new AvroSerializer(registry, {
  subject: "sensor-data-value",
});

const producer = kafka.producer({
  maxInFlightRequests: 1,
  idempotent: true,
});

// Produce message with schema validation
await producer.send({
  topic: "sensor-data",
  messages: [
    {
      value: await serializer.serialize({
        sensor_id: "temp-01",
        timestamp: Date.now(),
        value: 23.5,
        unit: "celsius",
        location: "room-101",
      }),
    },
  ],
});
```

#### 4. Consumer Configuration

Configure consumers for Avro deserialization:

```javascript
const { AvroDeserializer } = require("@kafkajs/confluent-schema-registry");

const deserializer = new AvroDeserializer(registry, {
  subject: "sensor-data-value",
});

const consumer = kafka.consumer({ groupId: "sensor-processor" });

await consumer.run({
  eachMessage: async ({ message }) => {
    const data = await deserializer.deserialize(message.value);
    console.log("Received sensor data:", data);
  },
});
```

### Schema Evolution Guidelines

1. **Backward Compatibility**: New schema versions can read data written with previous versions
2. **Forward Compatibility**: Previous schema versions can read data written with new versions
3. **Full Compatibility**: Both backward and forward compatibility
4. **Breaking Changes**: Require new major version and coordinated deployment

### Schema Manager Script Usage

```bash
# List all registered schemas
./scripts/schema-manager.sh list

# Register a new schema
./scripts/schema-manager.sh register sensor-data ./schemas/sensor-data.avsc

# Get latest schema version
./scripts/schema-manager.sh get sensor-data-value

# Check schema compatibility
./scripts/schema-manager.sh check-compatibility sensor-data-value ./schemas/sensor-data-v2.avsc

# Register IoT platform schemas
./scripts/schema-manager.sh register-iot-schemas
```

## 🎯 Topic Management

### Using the Topic Manager Script

```bash
# List all topics
./scripts/topic-manager.sh list

# Create a topic with custom settings
./scripts/topic-manager.sh -p 6 -r 3 create user-events

# Describe a specific topic
./scripts/topic-manager.sh describe sensor-data

# Delete a topic (with confirmation)
./scripts/topic-manager.sh delete old-topic

# Test producer/consumer
./scripts/topic-manager.sh produce sensor-data
./scripts/topic-manager.sh consume sensor-data
```

### IoT Platform Topics

#### Standard Topics

- `sensor-data`: IoT sensor measurements
- `device-events`: Device lifecycle events
- `system-logs`: Application and system logs
- `user-activity`: User interaction events
- `notifications`: System notifications
- `metrics`: Application metrics
- `audit-logs`: Security and compliance logs

#### Dead Letter Queue Topics

- `*.dlq`: General DLQ for each topic
- `*.dlq.validation_error`: Schema validation failures
- `*.dlq.processing_error`: Processing failures
- `*.dlq.poison`: Poison pill messages

## 🔒 Security Configuration

### Development

- No authentication (PLAINTEXT)
- No authorization
- No encryption

### Production (Configurable)

- SSL/TLS encryption
- SASL authentication (SCRAM-SHA-512)
- ACL authorization
- mTLS for inter-broker communication

```bash
# Example SSL configuration (uncomment in server.properties)
ssl.keystore.location=/etc/kafka/security/kafka.server.keystore.jks
ssl.keystore.password=password
ssl.truststore.location=/etc/kafka/security/kafka.server.truststore.jks
ssl.truststore.password=password
```

## 🚨 Fault Tolerance Features

### High Availability

- **Multi-Broker Setup**: 3 brokers with automatic failover
- **Replication**: All topics replicated across brokers
- **Load Balancing**: HAProxy distributes client connections
- **Health Checks**: Continuous monitoring of broker health

### Data Durability

- **Min ISR**: Ensures at least 2 replicas are in-sync
- **Acks=All**: Producer waits for all replicas to acknowledge
- **Unclean Leader Election**: Disabled to prevent data loss
- **Log Flushing**: Periodic data persistence to disk

### Disaster Recovery

- **Cross-AZ Deployment**: Ready for multi-zone setup
- **Backup Strategies**: Configurable retention policies
- **Recovery Procedures**: Documented in deployment scripts

## 🔄 Client Configuration

### Development

```properties
bootstrap.servers=localhost:9092
acks=1
retries=3
enable.idempotence=false
```

### Production

```properties
bootstrap.servers=localhost:9095  # Load balancer
# Or direct: localhost:9092,localhost:9093,localhost:9094
acks=all
retries=2147483647
enable.idempotence=true
max.in.flight.requests.per.connection=5
compression.type=snappy
```

## 📋 Operational Procedures

### Daily Operations

```bash
# Check cluster health
./scripts/deploy-prod.sh --health-check

# Monitor topic lag
./scripts/topic-manager.sh -e prod describe

# View logs
docker logs kafka-1 --tail 100 -f
```

### Scaling Operations

```bash
# Add partitions to a topic
./scripts/topic-manager.sh -e prod -p 12 alter sensor-data

# Check consumer group status
docker exec kafka-1 kafka-consumer-groups --bootstrap-server localhost:9092 --describe --all-groups
```

### Troubleshooting

```bash
# Check container status
docker ps --filter name=kafka

# View detailed container logs
docker logs kafka-1 --details

# Test connectivity
docker exec kafka-1 kafka-broker-api-versions --bootstrap-server localhost:9092

# Check topic configurations
./scripts/topic-manager.sh config sensor-data
```

## 📈 Performance Tuning

### Development Optimizations

- Reduced heap size for local development
- Single partition topics for simplicity
- Fast consumer rebalancing
- Minimal log retention

### Production Optimizations

- Optimized JVM settings with G1GC
- Multiple partitions for parallelism
- Tuned network and I/O threads
- Compression for bandwidth efficiency
- Optimized batch sizes and linger times

## 🔧 Maintenance Tasks

### Regular Maintenance

```bash
# Clean up old logs
docker exec kafka-1 kafka-log-dirs --bootstrap-server localhost:9092 --describe

# Check disk usage
docker exec kafka-1 df -h /var/lib/kafka/data

# Update configurations
./scripts/deploy-prod.sh --clean
./scripts/deploy-prod.sh
```

### Backup Procedures

```bash
# Backup topic configurations
./scripts/topic-manager.sh -e prod list > topics-backup.txt

# Backup consumer offsets
docker exec kafka-1 kafka-consumer-groups --bootstrap-server localhost:9092 --all-groups --describe > offsets-backup.txt
```

## 🆘 Emergency Procedures

### Broker Failure

1. Check which broker is down
2. Verify remaining brokers are healthy
3. Check if leadership rebalancing occurred
4. Restart failed broker
5. Monitor recovery progress

### Split Brain Prevention

- KRaft mode eliminates Zookeeper split-brain
- Controller quorum requires majority consensus
- Automatic leader election with proper timeouts

### Data Loss Prevention

- Never reduce `min.insync.replicas` below 2
- Always use `acks=all` for critical data
- Monitor under-replicated partitions
- Regular backup of topic configurations

## 🔗 Integration Examples

### Node.js Client with Schema Registry

```javascript
const kafka = require("kafkajs");
const {
  SchemaRegistry,
  AvroSerializer,
  AvroDeserializer,
} = require("@kafkajs/confluent-schema-registry");

// Kafka client configuration
const client = kafka({
  clientId: "iot-platform-client",
  brokers: ["localhost:9095"], // Load balancer
  retry: {
    initialRetryTime: 100,
    retries: 8,
  },
});

// Schema Registry configuration
const registry = new SchemaRegistry({
  host: "http://localhost:8081",
  retry: {
    maxRetryTimeInSecs: 30,
    initialRetryTimeInSecs: 1,
    maxRetries: 5,
  },
});

// Producer with Avro serialization
const producer = client.producer({
  maxInFlightRequests: 1,
  idempotent: true,
  transactionTimeout: 30000,
});

const serializer = new AvroSerializer(registry, {
  subject: "sensor-data-value",
});

await producer.send({
  topic: "sensor-data",
  messages: [
    {
      key: "sensor-01",
      value: await serializer.serialize({
        sensor_id: "temp-sensor-01",
        timestamp: Date.now(),
        value: 25.3,
        unit: "celsius",
      }),
    },
  ],
});
```

### Error Handling Integration with Schema Registry

```javascript
import { ErrorHandlingService } from "./services/error-handling";
import {
  SchemaRegistry,
  AvroDeserializer,
} from "@kafkajs/confluent-schema-registry";

const registry = new SchemaRegistry({ host: "http://localhost:8081" });
const deserializer = new AvroDeserializer(registry);

const errorHandler = new ErrorHandlingService(kafkaService, {
  enableDLQ: true,
  enableRetries: true,
  enableCircuitBreaker: true,
});

// Enhanced message processing with schema validation
const processMessage = async (message) => {
  try {
    // Deserialize with schema validation
    const data = await deserializer.deserialize(message.value);

    // Process business logic
    return await businessLogicProcessor(data);
  } catch (schemaError) {
    // Schema validation errors are non-retryable
    throw new Error(`SCHEMA_VALIDATION: ${schemaError.message}`);
  }
};
```

## 📚 Additional Resources

- [Kafka Documentation](https://kafka.apache.org/documentation/)
- [Schema Registry Guide](https://docs.confluent.io/platform/current/schema-registry/)
- [Avro Schema Documentation](https://avro.apache.org/docs/current/)
- [KRaft Mode Guide](https://kafka.apache.org/documentation/#kraft)
- [Production Deployment Best Practices](https://kafka.apache.org/documentation/#producerconfigs)

## 🐛 Troubleshooting Guide

### Common Issues and Solutions

#### 1. Kafka Broker Startup Failure

**Error**: `Only one of inter.broker.listener.name and security.inter.broker.protocol should be set`

- **Cause**: Conflicting configuration between environment variables
- **Solution**: Ensure only `KAFKA_INTER_BROKER_LISTENER_NAME` is set in docker-compose.yml
- **Fixed in**: Both dev and prod configurations have been updated

#### 2. HAProxy Configuration Error

**Error**: `Missing LF on last line, file might have been truncated`

- **Cause**: Configuration file missing newline at end
- **Solution**: Add newline to end of haproxy.cfg file
- **Fixed in**: Production haproxy.cfg

#### 3. HAProxy Permission Denied

**Error**: `cannot bind UNIX socket (Permission denied) [/var/run/haproxy.sock]`

- **Cause**: Container user permissions for socket creation
- **Solution**: Comment out user/group and stats socket settings in haproxy.cfg
- **Fixed in**: Production haproxy.cfg

#### 4. Container Name Conflicts

**Error**: `Conflict. The container name "/kafka" is already in use`

- **Cause**: Existing containers from previous sessions (e.g., devcontainer)
- **Solution**:
  ```bash
  # Clean up existing containers
  docker rm -f kafka kafka-ui kafka-dev kafka-1 kafka-2 kafka-3
  # Clean up networks
  docker network rm iot-platform-network iot-platform-dev iot-platform-prod
  ```

#### 5. Schema Registry Connection Issues

**Error**: `Schema Registry not accessible`

- **Cause**: Schema Registry depends on Kafka being fully started
- **Solution**: Wait 30-60 seconds after Kafka starts before accessing Schema Registry

### Development Environment Specific

- **Issue**: Slow startup on limited resources
- **Solution**: Reduce heap size in docker-compose.yml: `KAFKA_HEAP_OPTS: '-Xmx256M -Xms256M'`

### Production Environment Specific

- **Issue**: Broker communication failures in multi-broker setup
- **Solution**: Ensure all three brokers are started together: `docker compose -f docker-compose.prod.yml up -d kafka-1 kafka-2 kafka-3`

- **Issue**: HAProxy health check failures
- **Solution**: Verify Kafka brokers are healthy before starting HAProxy

## 🔍 Verification Steps

### Development Environment

```bash
# Check all services are running
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Test Kafka connectivity
docker exec kafka-dev kafka-topics --bootstrap-server localhost:29092 --list

# Verify Schema Registry
curl -s http://localhost:8081/config | jq .

# Check Kafka UI
open http://localhost:8080
```

### Production Environment

```bash
# Check all brokers are healthy
for i in 1 2 3; do
  docker exec kafka-$i kafka-broker-api-versions --bootstrap-server localhost:29092
done

# Verify HAProxy load balancing
curl http://localhost:8404/stats

# Test load balanced connection
docker run --rm --network iot-platform-prod \
  confluentinc/cp-kafka:7.5.0 \
  kafka-topics --bootstrap-server kafka-lb:9095 --list
```

## 🤝 Contributing

When contributing to Kafka configurations:

1. Test changes in development environment first
2. Update both dev and prod configurations consistently
3. Document configuration changes in this README
4. Test deployment scripts after modifications
5. Update monitoring dashboards if metrics change
6. Ensure configuration files end with newlines
7. Test cleanup procedures to avoid naming conflicts

---

**For support and questions**, refer to the project documentation or create an issue in the repository.
