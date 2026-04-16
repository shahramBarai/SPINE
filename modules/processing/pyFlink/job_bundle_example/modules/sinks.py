"""
modules.sinks
===============
Sink builders: TimescaleDB (JDBC) and Kafka.
"""

from pyflink.common.serialization import SimpleStringSchema
from pyflink.datastream.connectors import JdbcSink
from pyflink.datastream.connectors.jdbc import JdbcConnectionOptions, JdbcExecutionOptions
from pyflink.datastream.connectors.kafka import (
    KafkaSink,
    KafkaRecordSerializationSchema,
)

from .config import (
    KAFKA_BROKERS,
    KAFKA_SINK_TOPIC,
    TIMESCALE_HOST_PORT,
    TIMESCALE_DB,
    TIMESCALE_USER,
    TIMESCALE_PASSWORD,
)


def build_timescale_sink(sql_dml: str, type_info) -> JdbcSink:
    """Create a JdbcSink that writes rows to TimescaleDB."""
    return JdbcSink.sink(
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


def build_kafka_sink() -> KafkaSink:
    """Create a KafkaSink that writes raw JSON strings to KAFKA_SINK_TOPIC."""
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
