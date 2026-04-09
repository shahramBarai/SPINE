"""
exceptions.py – Custom exceptions for the Flink submission worker.

Kept intentionally minimal. Extend as needed.
"""


class BundleValidationError(Exception):
    """Raised when the job bundle fails structural validation."""


class PreSubmitCheckError(Exception):
    """Raised when Python pre-submit checks (AST syntax checks / import) fail."""


class FlinkSubmitError(Exception):
    """Raised when the Flink CLI command exits with a non-zero return code."""
