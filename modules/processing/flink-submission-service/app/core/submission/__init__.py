"""
core/submission/ – Flink submission pipeline.

Handles building and executing the `flink run --detached` command.
"""

from .executor import submit_job

__all__ = ["submit_job"]
