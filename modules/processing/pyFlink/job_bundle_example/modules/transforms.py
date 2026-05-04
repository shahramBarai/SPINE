"""
modules.transforms
====================
Map function: raw JSON string → pyflink Row.
"""

import json
import datetime as dt

from pyflink.common import Row


def parse_data(data: str) -> Row:
    """
    Parse a raw Kafka message (JSON string) into a Row.

    Supports two timestamp formats:
      - Numeric  (epoch seconds or milliseconds)
      - ISO-8601 string (e.g. "2026-03-23T17:14:59Z")

    Returns:
        Row(sensor_timestamp: datetime, sensor_id: str, message: str)
    """
    payload = json.loads(data)

    sensor_id = payload["sensorId"]

    ts = payload["timestamp"]
    if isinstance(ts, (int, float)):
        # Millisecond epoch → convert to seconds
        if ts > 1e11:
            ts = ts / 1000.0
        sensor_timestamp = dt.datetime.fromtimestamp(ts, tz=dt.timezone.utc).replace(tzinfo=None)
    else:
        # ISO-8601 string
        try:
            ts = ts.replace("Z", "+00:00")
            sensor_timestamp = dt.datetime.fromisoformat(ts).replace(tzinfo=None)
        except ValueError:
            sensor_timestamp = dt.datetime.strptime(ts, "%Y-%m-%dT%H:%M:%S.%f+00:00")

    message = json.dumps(payload["measurement"])

    return Row(sensor_timestamp, sensor_id, message)
