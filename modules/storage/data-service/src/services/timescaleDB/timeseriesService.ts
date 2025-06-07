import { timescaleDb } from "../../db/timescale";

export interface TimeseriesAggregationOptions {
  sensorId?: string;
  topic?: string;
  schemaRef?: string;
  startTime: Date;
  endTime: Date;
  interval?: string; // e.g., '1 hour', '15 minutes', '1 day'
}

export interface DownsamplingOptions {
  sensorId: string;
  startTime: Date;
  endTime: Date;
  bucketSize: string; // e.g., '1 hour', '15 minutes'
  aggregationField?: string;
}

export class TimeseriesService {
  // Get time-bucketed aggregations using raw SQL for TimescaleDB functions
  static async getTimeBucketAggregation(options: TimeseriesAggregationOptions) {
    const interval = options.interval || "1 hour";

    let whereClause = "WHERE sensor_timestamp >= $1 AND sensor_timestamp <= $2";
    const params: any[] = [options.startTime, options.endTime];
    let paramIndex = 3;

    if (options.sensorId) {
      whereClause += ` AND sensor_id = $${paramIndex}`;
      params.push(options.sensorId);
      paramIndex++;
    }

    if (options.topic) {
      whereClause += ` AND topic = $${paramIndex}`;
      params.push(options.topic);
      paramIndex++;
    }

    if (options.schemaRef) {
      whereClause += ` AND schema_ref = $${paramIndex}`;
      params.push(options.schemaRef);
      paramIndex++;
    }

    const query = `
      SELECT 
        time_bucket('${interval}', sensor_timestamp) as time_bucket,
        COUNT(*) as reading_count,
        MIN(sensor_timestamp) as first_reading,
        MAX(sensor_timestamp) as last_reading
      FROM sensor_readings
      ${whereClause}
      GROUP BY time_bucket
      ORDER BY time_bucket;
    `;

    return timescaleDb.$queryRaw`${query}`;
  }

  // Get average values over time buckets (for numeric sensor data)
  static async getNumericAggregation(
    options: TimeseriesAggregationOptions & {
      payloadField: string;
    }
  ) {
    const interval = options.interval || "1 hour";

    let whereClause = "WHERE sensor_timestamp >= $1 AND sensor_timestamp <= $2";
    const params: any[] = [options.startTime, options.endTime];
    let paramIndex = 3;

    if (options.sensorId) {
      whereClause += ` AND sensor_id = $${paramIndex}`;
      params.push(options.sensorId);
      paramIndex++;
    }

    // Query to extract numeric values from JSON payload and aggregate them
    const query = `
      SELECT 
        time_bucket('${interval}', sensor_timestamp) as time_bucket,
        COUNT(*) as reading_count,
        AVG((payload->>'${options.payloadField}')::numeric) as avg_value,
        MIN((payload->>'${options.payloadField}')::numeric) as min_value,
        MAX((payload->>'${options.payloadField}')::numeric) as max_value,
        STDDEV((payload->>'${options.payloadField}')::numeric) as stddev_value
      FROM sensor_readings
      ${whereClause}
      AND payload->>'${options.payloadField}' IS NOT NULL
      AND payload->>'${options.payloadField}' ~ '^-?\\d+(\\.\\d+)?$'
      GROUP BY time_bucket
      ORDER BY time_bucket;
    `;

    return timescaleDb.$queryRawUnsafe(query, ...params);
  }

  // Get readings frequency analysis
  static async getReadingFrequencyAnalysis(
    sensorId: string,
    startTime: Date,
    endTime: Date
  ) {
    const query = `
      SELECT 
        sensor_id,
        topic,
        schema_ref,
        COUNT(*) as total_readings,
        MIN(sensor_timestamp) as first_reading,
        MAX(sensor_timestamp) as last_reading,
        EXTRACT(EPOCH FROM (MAX(sensor_timestamp) - MIN(sensor_timestamp))) / COUNT(*) as avg_interval_seconds
      FROM sensor_readings
      WHERE sensor_id = $1 
        AND sensor_timestamp >= $2 
        AND sensor_timestamp <= $3
      GROUP BY sensor_id, topic, schema_ref
      ORDER BY total_readings DESC;
    `;

    return timescaleDb.$queryRawUnsafe(query, sensorId, startTime, endTime);
  }

  // Get data quality metrics
  static async getDataQualityMetrics(options: TimeseriesAggregationOptions) {
    let whereClause = "WHERE sensor_timestamp >= $1 AND sensor_timestamp <= $2";
    const params: any[] = [options.startTime, options.endTime];
    let paramIndex = 3;

    if (options.sensorId) {
      whereClause += ` AND sensor_id = $${paramIndex}`;
      params.push(options.sensorId);
      paramIndex++;
    }

    const query = `
      SELECT 
        sensor_id,
        topic,
        schema_ref,
        COUNT(*) as total_readings,
        COUNT(DISTINCT sensor_id) as unique_sensors,
        COUNT(CASE WHEN payload IS NULL THEN 1 END) as null_payloads,
        COUNT(CASE WHEN payload = '{}' THEN 1 END) as empty_payloads,
        ROUND(
          (COUNT(CASE WHEN payload IS NOT NULL AND payload != '{}' THEN 1 END)::numeric / COUNT(*)::numeric) * 100, 
          2
        ) as data_completeness_percentage
      FROM sensor_readings
      ${whereClause}
      GROUP BY sensor_id, topic, schema_ref
      ORDER BY total_readings DESC;
    `;

    return timescaleDb.$queryRawUnsafe(query, ...params);
  }

  // Get readings by time pattern (hourly distribution)
  static async getHourlyDistribution(options: TimeseriesAggregationOptions) {
    let whereClause = "WHERE sensor_timestamp >= $1 AND sensor_timestamp <= $2";
    const params: any[] = [options.startTime, options.endTime];
    let paramIndex = 3;

    if (options.sensorId) {
      whereClause += ` AND sensor_id = $${paramIndex}`;
      params.push(options.sensorId);
      paramIndex++;
    }

    const query = `
      SELECT 
        EXTRACT(HOUR FROM sensor_timestamp) as hour_of_day,
        COUNT(*) as reading_count,
        COUNT(DISTINCT sensor_id) as unique_sensors
      FROM sensor_readings
      ${whereClause}
      GROUP BY EXTRACT(HOUR FROM sensor_timestamp)
      ORDER BY hour_of_day;
    `;

    return timescaleDb.$queryRawUnsafe(query, ...params);
  }

  // Get top sensors by activity
  static async getTopSensorsByActivity(
    startTime: Date,
    endTime: Date,
    limit: number = 10
  ) {
    const query = `
      SELECT 
        sensor_id,
        COUNT(*) as reading_count,
        COUNT(DISTINCT topic) as unique_topics,
        COUNT(DISTINCT schema_ref) as unique_schemas,
        MIN(sensor_timestamp) as first_reading,
        MAX(sensor_timestamp) as last_reading
      FROM sensor_readings
      WHERE sensor_timestamp >= $1 AND sensor_timestamp <= $2
      GROUP BY sensor_id
      ORDER BY reading_count DESC
      LIMIT $3;
    `;

    return timescaleDb.$queryRawUnsafe(query, startTime, endTime, limit);
  }

  // Get compressed chunks info (TimescaleDB specific)
  static async getCompressionInfo() {
    const query = `
      SELECT 
        chunk_schema,
        chunk_name,
        compression_status,
        before_compression_table_bytes,
        before_compression_index_bytes,
        before_compression_toast_bytes,
        after_compression_table_bytes,
        after_compression_index_bytes,
        after_compression_toast_bytes
      FROM timescaledb_information.compressed_chunk_stats
      ORDER BY before_compression_table_bytes DESC;
    `;

    try {
      return await timescaleDb.$queryRawUnsafe(query);
    } catch (error) {
      // Return empty array if compression extension is not available
      return [];
    }
  }

  // Get hypertable info
  static async getHypertableInfo() {
    const query = `
      SELECT 
        hypertable_name,
        owner,
        num_dimensions,
        num_chunks,
        compression_enabled,
        tablespace
      FROM timescaledb_information.hypertables
      WHERE hypertable_name = 'sensor_readings';
    `;

    try {
      return await timescaleDb.$queryRawUnsafe(query);
    } catch (error) {
      // Return empty array if TimescaleDB extension is not available
      return [];
    }
  }

  // Downsample data (using TimescaleDB continuous aggregates concept)
  static async downsampleData(options: DownsamplingOptions) {
    const bucketSize = options.bucketSize || "1 hour";

    const query = `
      SELECT 
        time_bucket('${bucketSize}', sensor_timestamp) as time_bucket,
        sensor_id,
        topic,
        schema_ref,
        COUNT(*) as reading_count,
        FIRST(payload, sensor_timestamp) as first_payload,
        LAST(payload, sensor_timestamp) as last_payload
      FROM sensor_readings
      WHERE sensor_id = $1 
        AND sensor_timestamp >= $2 
        AND sensor_timestamp <= $3
      GROUP BY time_bucket, sensor_id, topic, schema_ref
      ORDER BY time_bucket;
    `;

    return timescaleDb.$queryRawUnsafe(
      query,
      options.sensorId,
      options.startTime,
      options.endTime
    );
  }

  // Get gaps in data (missing time periods)
  static async getDataGaps(
    sensorId: string,
    startTime: Date,
    endTime: Date,
    expectedInterval: string = "1 minute"
  ) {
    const query = `
      SELECT 
        sensor_timestamp + INTERVAL '${expectedInterval}' as gap_start,
        LEAD(sensor_timestamp) OVER (ORDER BY sensor_timestamp) as gap_end,
        EXTRACT(EPOCH FROM (
          LEAD(sensor_timestamp) OVER (ORDER BY sensor_timestamp) - 
          (sensor_timestamp + INTERVAL '${expectedInterval}')
        )) as gap_duration_seconds
      FROM sensor_readings
      WHERE sensor_id = $1 
        AND sensor_timestamp >= $2 
        AND sensor_timestamp <= $3
      ORDER BY sensor_timestamp;
    `;

    return timescaleDb.$queryRawUnsafe(query, sensorId, startTime, endTime);
  }

  // Get data retention policy info
  static async getRetentionPolicyInfo() {
    const query = `
      SELECT 
        hypertable,
        older_than,
        cascade
      FROM timescaledb_information.drop_chunks_policies;
    `;

    try {
      return await timescaleDb.$queryRawUnsafe(query);
    } catch (error) {
      return [];
    }
  }
}
