"""
PyFlink Smoke-Test Job
======================
Reads JSON sensor messages from a Kafka topic, parses them, then writes
the results to two sinks:
  1. TimescaleDB   via the Flink JDBC connector (JdbcSink)
  2. Kafka         via the Flink Kafka connector (KafkaSink)

Message format (JSON):
{
  "timestamp": "2026-03-23T17:14:59Z",
  "sensorId": "sensor-1",
  "measurement": key-value pairs
}

Required TimescaleDB table
--------------------------
sensor_data (
    time        TIMESTAMPTZ NOT NULL,
    id          TEXT        NOT NULL,
    data        JSONB       NOT NULL,
    PRIMARY KEY (id, time)
);
"""

# ===========================================================================
# Parameters – adjust these before running the job
# ===========================================================================

KAFKA_BROKERS       = "kafka:29092"
KAFKA_SOURCE_TOPIC  = "sensor-data"
KAFKA_SINK_TOPIC    = "test-topic"
KAFKA_GROUP_ID      = "pyflink-smoke-test"

TIMESCALE_HOST_PORT = "timescaledb:5432"
TIMESCALE_DB        = "timescale"
TIMESCALE_USER      = "username"
TIMESCALE_PASSWORD  = "password"

FLINK_JOB_NAME      = "PyFlink Smoke-Test: Kafka → TimescaleDB + Kafka"
FLINK_PARALLELISM   = 1

# Paths to connector JARs (populated by download_libs.sh)
JAR_KAFKA           = "file:///opt/flink/lib/flink-sql-connector-kafka-3.1.0-1.18.jar"
JAR_JDBC            = "file:///opt/flink/lib/flink-connector-jdbc-3.1.2-1.18.jar"
JAR_POSTGRES        = "file:///opt/flink/lib/postgresql-42.7.3.jar"

# ===========================================================================
# Imports
# ===========================================================================

import json
import logging
from datetime import datetime

from pyflink.common import Row, Types, WatermarkStrategy
from pyflink.common.serialization import SimpleStringSchema

from pyflink.datastream import StreamExecutionEnvironment
from pyflink.datastream.connectors.kafka import (
    KafkaSource,
    KafkaSink,
    KafkaOffsetsInitializer,
    KafkaRecordSerializationSchema,
)

from pyflink.datastream.connectors import JdbcSink
from pyflink.datastream.connectors.jdbc import (
    JdbcConnectionOptions,
    JdbcExecutionOptions,
)

# ===========================================================================
# Environment builder
# ===========================================================================

def init_env():
    """Initialize the Flink stream environment."""
    env = StreamExecutionEnvironment.get_execution_environment()
    # Set parallelism
    env.set_parallelism(FLINK_PARALLELISM)
    # Register connector JARs (downloaded by download_libs.sh)
    env.add_jars(JAR_KAFKA, JAR_JDBC, JAR_POSTGRES)
    return env
    

# ===========================================================================
# Source builder
# ===========================================================================

def build_kafka_source() -> KafkaSource:
    """Create a KafkaSource that reads raw JSON strings from KAFKA_SOURCE_TOPIC."""
    return (
        KafkaSource.builder()
        .set_bootstrap_servers(KAFKA_BROKERS)
        .set_topics(KAFKA_SOURCE_TOPIC)
        .set_group_id(KAFKA_GROUP_ID)
        .set_starting_offsets(KafkaOffsetsInitializer.earliest())
        .set_value_only_deserializer(SimpleStringSchema())
        .build()
    )

# ===========================================================================
# Map function: JSON string → Row
# ===========================================================================

def parse_data(data: str) -> Row:
    data = json.loads(data)

    sensor_id = data["sensorId"]
    
    ts = data["timestamp"]
    if isinstance(ts, (int, float)):
        # If timestamp is in milliseconds (usually > 1e11), convert to seconds
        if ts > 1e11:
            ts = ts / 1000.0
        # Create naive datetime representing UTC time
        import datetime as dt
        sensor_timestamp = dt.datetime.fromtimestamp(ts, tz=dt.timezone.utc).replace(tzinfo=None)
    else:
        # Fallback for string
        try:
            ts = ts.replace("Z", "+00:00")
            import datetime as dt
            sensor_timestamp = dt.datetime.fromisoformat(ts).replace(tzinfo=None)
        except ValueError:
            sensor_timestamp = datetime.strptime(ts, "%Y-%m-%dT%H:%M:%S.%f+00:00")

    message = json.dumps(data["measurement"])
    
    return Row(sensor_timestamp, sensor_id, message)


# ===========================================================================
# Sink 1: TimescaleDB
# ===========================================================================

def build_timescale_sink(sql_dml: str, type_info: Types) -> JdbcSink:
    """Create a TimescaleDB sink that writes rows to the database."""
    return (
        JdbcSink.sink(
            sql_dml,
            type_info,
            JdbcConnectionOptions.JdbcConnectionOptionsBuilder()
            .with_url(f"jdbc:postgresql://{TIMESCALE_HOST_PORT}/{TIMESCALE_DB}")
            .with_user_name(TIMESCALE_USER)
            .with_password(TIMESCALE_PASSWORD)
            .with_driver_name("org.postgresql.Driver")
            .build(),
            JdbcExecutionOptions.builder()
            .with_batch_interval_ms(1000)
            .with_batch_size(200)
            .with_max_retries(5)
            .build(),
        )
    )
            

# ===========================================================================
# Sink 2: Kafka builder
# ===========================================================================

def build_kafka_sink() -> KafkaSink:
    """Create a KafkaSink that writes serialised JSON strings to KAFKA_SINK_TOPIC."""
    return (
        KafkaSink.builder()
        .set_bootstrap_servers(KAFKA_BROKERS)
        .set_record_serializer(
            KafkaRecordSerializationSchema.builder()
            .set_topic(KAFKA_SINK_TOPIC)
            .set_value_serialization_schema(SimpleStringSchema())
            .build()
        )
        .build()
    )

# ===========================================================================
# Flink job entry-point
# ===========================================================================

def main():
    # -- Logging -------------------------------------------------------------
    logger = logging.getLogger(__name__)
    logger.setLevel(logging.INFO)
    logger.addHandler(logging.StreamHandler())
    

    # -- Environment ---------------------------------------------------------
    logger.info("Initializing Flink environment...")
    env = init_env()

    # -- Define source and sinks --------------------------------------------------------------
    logger.info("Defining source and sink...")
    
    kafka_source = build_kafka_source()
    logger.info("1. Kafka source defined.")
    
    TYPE_INFO = Types.ROW([Types.SQL_TIMESTAMP(), Types.STRING(), Types.STRING()])
    timescale_sink = build_timescale_sink("INSERT INTO sensor_readings (time, id, data) VALUES (?, ?, ?::jsonb)", TYPE_INFO)
    logger.info("2. Timescale sink defined.")
    
    kafka_sink = build_kafka_sink()
    logger.info("3. Kafka sink defined.")
    
    # -- Create raw stream from Kafka source --------------------------------------------------------------
    raw_stream = env.from_source(
        kafka_source,
        WatermarkStrategy.no_watermarks(),
        "Kafka Source",
    )

    # -- Parse for TimescaleDB -----------------------------------------------
    parsed_stream = raw_stream.map(parse_data, output_type=TYPE_INFO)

    # -- Sink data to TimescaleDB and Kafka ----------------------------------
    logger.info("Ready to sink data to TimescaleDB and Kafka...")
    parsed_stream.add_sink(timescale_sink)
    raw_stream.sink_to(kafka_sink)

    # -- Execute -------------------------------------------------------------
    logger.info(
        "Starting job '%s' | source_topic=%s sink_topic=%s brokers=%s",
        FLINK_JOB_NAME,
        KAFKA_SOURCE_TOPIC,
        KAFKA_SINK_TOPIC,
        KAFKA_BROKERS,
    )
    env.execute(FLINK_JOB_NAME)


if __name__ == "__main__":
    main()
