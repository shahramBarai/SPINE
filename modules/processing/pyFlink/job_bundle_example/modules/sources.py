"""
modules.sources
=================
Kafka source builder for the PyFlink job.
"""

from pyflink.common.serialization import SimpleStringSchema
from pyflink.datastream.connectors.kafka import KafkaSource, KafkaOffsetsInitializer

from .config import KAFKA_BROKERS, KAFKA_SOURCE_TOPIC, KAFKA_GROUP_ID


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
