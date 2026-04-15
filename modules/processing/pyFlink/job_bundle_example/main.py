"""
main.py – PyFlink job orchestration entrypoint
===============================================
Submit with:

  flink run --detached \\
    --jobmanager jobmanager:8081 \\
    --python  ./job_bundle/main.py \\
    --pyFiles ./job_bundle/modules \\
    --pyRequirements ./job_bundle/requirements.txt
"""

import logging

from pyflink.common import WatermarkStrategy

from modules.config import (
    FLINK_JOB_NAME,
    KAFKA_SOURCE_TOPIC,
    KAFKA_SINK_TOPIC,
    KAFKA_BROKERS,
    ROW_TYPE_INFO,
    TIMESCALE_INSERT_SQL,
)
from modules.env import init_env
from modules.sources import build_kafka_source
from modules.transforms import parse_data
from modules.sinks import build_timescale_sink, build_kafka_sink


def main():
    # -- Logging -------------------------------------------------------------
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)

    # -- Environment ---------------------------------------------------------
    logger.info("Initializing Flink environment...")
    env = init_env()

    # -- Sources & sinks -----------------------------------------------------
    logger.info("Defining source and sinks...")

    kafka_source = build_kafka_source()
    logger.info("1. Kafka source defined.")

    timescale_sink = build_timescale_sink(TIMESCALE_INSERT_SQL, ROW_TYPE_INFO)
    logger.info("2. Timescale sink defined.")

    kafka_sink = build_kafka_sink()
    logger.info("3. Kafka sink defined.")

    # -- Streaming graph -----------------------------------------------------
    raw_stream = env.from_source(
        kafka_source,
        WatermarkStrategy.no_watermarks(),
        "Kafka Source",
    )

    parsed_stream = raw_stream.map(parse_data, output_type=ROW_TYPE_INFO)

    # -- Attach sinks --------------------------------------------------------
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
