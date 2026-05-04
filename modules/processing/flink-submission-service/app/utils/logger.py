"""
app/utils/logger.py – Shared logger helpers for the Flink submission worker.
"""

from __future__ import annotations

import logging

from . import config


def configure_logging() -> None:
    """Configure the root logger for the submission worker."""
    logging.basicConfig(
        level=logging.DEBUG if config.LOG_LEVEL == "DEV" else logging.INFO,
        format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    )


def get_logger(name: str) -> logging.Logger:
    """Return a module logger after ensuring logging is configured."""
    configure_logging()
    return logging.getLogger(name)
