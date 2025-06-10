# TimescaleDB Services

This directory contains services that manage time-series sensor data stored in TimescaleDB. These services provide optimized access patterns for high-frequency data ingestion, querying, and analytics.

## Service Overview

TimescaleDB services handle sensor data operations with optimized time-series performance, providing efficient queries and aggregations for IoT sensor data analytics.

### Core Services

- **[sensorDataService.ts](sensorDataService.ts)** - High-performance sensor data operations
- **[timeseriesService.ts](timeseriesService.ts)** - Advanced analytics and aggregations

## Service Responsibilities

### SensorDataService

- High-performance sensor data ingestion
- Time-range queries and filtering
- Schema-aware data validation
- Bulk operations and batch processing
- Latest reading retrieval
- Sensor-specific data management

### TimeseriesService

- Advanced time-bucketed aggregations
- Statistical analysis and trend detection
- Data quality metrics and gap analysis
- Compression and retention management
- Frequency analysis and pattern detection
- Numeric aggregations across time windows

## Time-Series Patterns

TimescaleDB services are optimized for time-series workloads:

```typescript
// Time-range queries
getReadingsInRange(sensorId: string, startTime: Date, endTime: Date): Promise<SensorReading[]>

// Aggregations
getAggregatedData(sensorId: string, interval: string, operation: 'avg' | 'sum' | 'count'): Promise<AggregatedReading[]>

// Latest data access
getLatestReading(sensorId: string): Promise<SensorReading | null>

// Bulk operations
createBulkReadings(readings: CreateSensorReadingData[]): Promise<void>
```

## Performance Optimizations

### Hypertable Design

- Automatic time-based partitioning for efficient storage
- Optimized queries across time-partitioned chunks
- Compression policies for historical data

### Batch Operations

- Bulk insertion patterns for high-throughput ingestion
- Efficient batch processing for analytics
- Memory-optimized streaming responses

### Query Optimization

- Indexed time-based queries
- Prepared statements for common operations
- Time-bucket aggregations using TimescaleDB functions

## Integration Patterns

### Kafka Integration

TimescaleDB services integrate with the platform's event-driven architecture:

```typescript
// Example: Processing sensor data from Kafka
async processSensorData(kafkaMessage: SensorDataMessage) {
  const sensorReading = await this.validateAndTransform(kafkaMessage)
  return await this.createSensorReading(sensorReading)
}
```

### Schema Coordination

Services coordinate with platform metadata for schema validation:

```typescript
// Schema-aware data validation
async validateSensorData(data: any, schemaRef: string): Promise<ValidationResult> {
  const schema = await schemaService.getSchemaByRef(schemaRef)
  return this.validateAgainstSchema(data, schema)
}
```

## Data Lifecycle Management

### Retention Policies

- Automatic cleanup of aged data based on configured policies
- Compression strategies for historical data
- Archive coordination with MinIO for long-term storage

### Quality Assurance

- Data gap detection and reporting
- Statistical analysis for anomaly detection
- Metadata tracking for data lineage

These services provide the foundation for all time-series data operations in the platform, optimized for IoT sensor data patterns and high-throughput requirements.
