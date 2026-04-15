"""
modules.env
=============
Flink StreamExecutionEnvironment initialisation.
"""

from pyflink.datastream import StreamExecutionEnvironment

from .config import FLINK_PARALLELISM


def init_env() -> StreamExecutionEnvironment:
    """Create and configure the Flink stream environment."""
    env = StreamExecutionEnvironment.get_execution_environment()
    env.set_parallelism(FLINK_PARALLELISM)
    return env
