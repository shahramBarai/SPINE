"""
PyFlink Smoke-Test Job
======================
Reads JSON sensor messages from a Kafka topic, parses them, then writes
the results to two sinks:
  1. TimescaleDB  – via a persistent psycopg2 connection (RichSinkFunction)
  2. Kafka        – via the Flink Kafka connector (KafkaSink)

Message format (JSON):
{
  "sensor_id": "sensor-1",
  "message": "...",
  "sensor_timestamp": {
    "secs_since_epoch": 1741862400,
    "nanos_since_epoch": 123000000
  }
}

Required TimescaleDB table
--------------------------
CREATE TABLE IF NOT EXISTS sensor_data (
    sensor_id        TEXT        NOT NULL,
    message          TEXT        NOT NULL,
    sensor_timestamp TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (sensor_id, sensor_timestamp)
);
SELECT create_hypertable('sensor_data', 'sensor_timestamp', if_not_exists => TRUE);
"""

# ===========================================================================
# Parameters – adjust these before running the job
# ===========================================================================

KAFKA_BROKERS       = "kafka:9092"
KAFKA_SOURCE_TOPIC  = "smartlab-sensor-data"
KAFKA_SINK_TOPIC    = "smartlab-sensor-data-processed"
KAFKA_GROUP_ID      = "pyflink-smoke-test"

TIMESCALE_URL       = "postgresql://postgres:postgres@timescaledb:5432/timescale"

FLINK_JOB_NAME      = "PyFlink Smoke-Test: Kafka → TimescaleDB + Kafka"
FLINK_PARALLELISM   = 1

# Paths to connector JARs (populated by download_libs.sh)
JAR_KAFKA           = "file:///opt/flink/lib/flink-sql-connector-kafka-3.2.0-1.18.jar"
JAR_JDBC            = "file:///opt/flink/lib/flink-connector-jdbc-3.2.0-1.18.jar"
JAR_POSTGRES        = "file:///opt/flink/lib/postgresql-42.7.10.jar"

# ===========================================================================
# Imports
# ===========================================================================

import json
import logging
import datetime

import psycopg2

from pyflink.datastream import StreamExecutionEnvironment
from pyflink.datastream.connectors.kafka import (
    KafkaSource,
    KafkaSink,
    KafkaOffsetsInitializer,
    KafkaRecordSerializationSchema,
)
from pyflink.common.serialization import SimpleStringSchema
from pyflink.common import WatermarkStrategy
from pyflink.datastream.functions import MapFunction, RichSinkFunction
from pyflink.common.typeinfo import Types

# ===========================================================================
# Logging
# ===========================================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s  %(message)s",
)
logger = logging.getLogger("pyflink-smoke-test")

# ===========================================================================
# Data model
# ===========================================================================

class SensorRecord:
    """Represents a single parsed sensor reading."""

    __slots__ = ("sensor_id", "message", "sensor_timestamp")

    def __init__(self, sensor_id: str, message: str, sensor_timestamp: datetime.datetime):
        self.sensor_id = sensor_id
        self.message = message
        self.sensor_timestamp = sensor_timestamp

    def to_json(self) -> str:
        """Serialise back to a JSON string for the Kafka sink."""
        return json.dumps({
            "sensor_id": self.sensor_id,
            "message": self.message,
            "sensor_timestamp": self.sensor_timestamp.isoformat(),
        })

    def __repr__(self):
        return (
            f"SensorRecord(sensor_id={self.sensor_id!r}, "
            f"sensor_timestamp={self.sensor_timestamp.isoformat()})"
        )

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
        .set_starting_offsets(KafkaOffsetsInitializer.latest())
        .set_value_only_deserializer(SimpleStringSchema())
        .build()
    )

# ===========================================================================
# Map function: JSON string → SensorRecord
# ===========================================================================

class ParseSensorMessage(MapFunction):
    """Deserialises the raw Kafka JSON string into a SensorRecord (or None on error)."""

    def map(self, raw: str):
        try:
            data = json.loads(raw)

            sensor_id = data["sensor_id"]
            message   = data["message"]

            ts_field = data["sensor_timestamp"]
            if isinstance(ts_field, dict):
                secs       = ts_field["secs_since_epoch"]
                nanos      = ts_field.get("nanos_since_epoch", 0)
                epoch_ms   = secs * 1000 + nanos // 1_000_000
                ts         = datetime.datetime.utcfromtimestamp(epoch_ms / 1000.0)
            else:
                # Fallback: ISO-8601 string or raw epoch millis
                try:
                    ts = datetime.datetime.fromisoformat(str(ts_field))
                except ValueError:
                    ts = datetime.datetime.utcfromtimestamp(int(ts_field) / 1000.0)

            return SensorRecord(sensor_id, message, ts)

        except Exception as exc:
            logger.error("Failed to parse message: %s | error: %s", raw, exc)
            return None

# ===========================================================================
# Map function: SensorRecord → JSON string  (for Kafka sink)
# ===========================================================================

class SerialiseToJson(MapFunction):
    """Converts a SensorRecord back to a JSON string, skipping None records."""

    def map(self, record):
        if record is None:
            return None
        return record.to_json()

# ===========================================================================
# Sink 1: TimescaleDB
# ===========================================================================

class TimescaleSink(RichSinkFunction):
    """
    Maintains a persistent psycopg2 connection to TimescaleDB.
    The connection is opened once per task-manager slot (open) and
    closed when the job finishes (close).
    Writes are idempotent via ON CONFLICT DO NOTHING.
    """

    def __init__(self, database_url: str):
        super().__init__()
        self._database_url = database_url
        self._conn   = None
        self._cursor = None

    # -- Lifecycle -----------------------------------------------------------

    def open(self, runtime_context):
        logger.info("TimescaleSink: opening connection …")
        self._connect()

    def close(self):
        self._close_conn()

    # -- Core sink -----------------------------------------------------------

    def invoke(self, record, context):
        if record is None:
            return  # skip unparseable messages

        try:
            self._ensure_conn()
            self._cursor.execute(
                """
                INSERT INTO sensor_data (sensor_id, message, sensor_timestamp)
                VALUES (%s, %s, %s)
                ON CONFLICT (sensor_id, sensor_timestamp) DO NOTHING
                """,
                (record.sensor_id, record.message, record.sensor_timestamp),
            )
            self._conn.commit()
            logger.info("TimescaleSink: wrote %s", record)
        except Exception as exc:
            logger.error("TimescaleSink: write error: %s | record: %s", exc, record)
            try:
                self._conn.rollback()
            except Exception:
                pass
            self._reconnect()

    # -- Helpers -------------------------------------------------------------

    def _connect(self):
        self._conn = psycopg2.connect(self._database_url)
        self._conn.autocommit = False
        self._cursor = self._conn.cursor()
        logger.info("TimescaleSink: connection established.")

    def _close_conn(self):
        try:
            if self._cursor:
                self._cursor.close()
            if self._conn:
                self._conn.close()
        except Exception as exc:
            logger.warning("TimescaleSink: error closing connection: %s", exc)

    def _ensure_conn(self):
        if self._conn is None or self._conn.closed:
            logger.warning("TimescaleSink: connection lost — reconnecting …")
            self._connect()

    def _reconnect(self):
        self._close_conn()
        try:
            self._connect()
        except Exception as exc:
            logger.error("TimescaleSink: reconnect failed: %s", exc)

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
    # -- Environment ---------------------------------------------------------
    env = StreamExecutionEnvironment.get_execution_environment()
    env.set_parallelism(FLINK_PARALLELISM)

    # Register connector JARs (downloaded by download_libs.sh)
    env.add_jars(JAR_KAFKA, JAR_JDBC, JAR_POSTGRES)

    # -- Source --------------------------------------------------------------
    raw_stream = env.from_source(
        build_kafka_source(),
        WatermarkStrategy.no_watermarks(),
        "Kafka Source",
    )

    # -- Parse ---------------------------------------------------------------
    parsed_stream = raw_stream.map(
        ParseSensorMessage(),
        output_type=Types.PICKLED_BYTE_ARRAY(),
    )

    # -- Sink 1: TimescaleDB -------------------------------------------------
    parsed_stream.add_sink(TimescaleSink(TIMESCALE_URL))

    # -- Sink 2: Kafka -------------------------------------------------------
    # Map SensorRecord → JSON string first, then hand off to KafkaSink
    json_stream = parsed_stream.map(
        SerialiseToJson(),
        output_type=Types.STRING(),
    ).filter(lambda s: s is not None)

    json_stream.sink_to(build_kafka_sink())

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
