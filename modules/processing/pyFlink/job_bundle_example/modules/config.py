"""
modules.config
================
All constants and type descriptors for the PyFlink job.
Adjust the values here before submitting the bundle.
"""

from pyflink.common import Types

# ---------------------------------------------------------------------------
# Kafka
# ---------------------------------------------------------------------------
KAFKA_BROKERS      = "kafka:29092"
KAFKA_SOURCE_TOPIC = "sensor-data"
KAFKA_SINK_TOPIC   = "test-topic"
KAFKA_GROUP_ID     = "pyflink-smoke-test"

# ---------------------------------------------------------------------------
# TimescaleDB
# ---------------------------------------------------------------------------
TIMESCALE_HOST_PORT = "timescaledb:5432"
TIMESCALE_DB        = "timescale"
TIMESCALE_USER      = "username"
TIMESCALE_PASSWORD  = "password"

# ---------------------------------------------------------------------------
# Flink job
# ---------------------------------------------------------------------------
FLINK_JOB_NAME    = "PyFlink Smoke-Test: Kafka → TimescaleDB + Kafka"
FLINK_PARALLELISM = 1

# ---------------------------------------------------------------------------
# JDBC sink
# ---------------------------------------------------------------------------
TIMESCALE_INSERT_SQL = (
    "INSERT INTO sensor_readings (time, id, data) VALUES (?, ?, ?::jsonb)"
)

# Row type: (TIMESTAMP, STRING, STRING)  – mirrors the JDBC INSERT above
ROW_TYPE_INFO = Types.ROW([Types.SQL_TIMESTAMP(), Types.STRING(), Types.STRING()])
