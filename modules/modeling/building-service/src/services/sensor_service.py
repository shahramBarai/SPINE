from __future__ import annotations

from pydantic import BaseModel
from datetime import datetime
from typing import Any, Optional

from deps import get_fuseki_client, get_timescale_client
from utils.sparql_helpers import get_binding_value, uri_to_id


# --- Initialize database clients ---
FusekiClient = get_fuseki_client()
TimescaleClient = get_timescale_client()

# --- Types and data models ---
class SensorSummary(BaseModel):
    id: str
    name: str
    kind: str
    status: str
    value: float
    unit: str
    bound: str

class SensorReading(BaseModel):
    id: str 
    timestamp: datetime
    data: object

# --- Transformations functions (helpers) ---

def _kind_from_text(text: str) -> tuple[str, str]:
    lower = text.lower()
    if "co2" in lower:
        return "CO2", "ppm"
    if "humid" in lower:
        return "Humidity", "%"
    if "occup" in lower:
        return "Occupancy", "ppl"
    if "power" in lower or "watt" in lower:
        return "Power", "kW"
    return "Temp", "C"


def _to_sensor(binding: dict[str, Any]) -> SensorSummary:
    sensor_uri = get_binding_value(binding, "sensor")
    label = get_binding_value(binding, "label") or uri_to_id(sensor_uri)
    observable = get_binding_value(binding, "observable")
    unit = get_binding_value(binding, "unit")
    value_raw = get_binding_value(binding, "value")
    bound_uri = get_binding_value(binding, "space")

    fallback_kind, fallback_unit = _kind_from_text(f"{label} {observable}")
    try:
        value = float(value_raw) if value_raw else 0.0
    except ValueError:
        value = 0.0

    return SensorSummary(
        id=uri_to_id(sensor_uri),
        name=label,
        kind=fallback_kind,
        status="live",
        value=value,
        unit=unit or fallback_unit,
        bound=uri_to_id(bound_uri),
    )


# --- Main service functions (use CRUD style naming) ---

# TODO: This function curretly return all sensors in the triplestore, regardless of their location.
# we should add support for filtering by location (building/zone/room).
def get_sensors() -> list[SensorSummary]:
    """Fetches a list of sensors from the Fuseki triplestore and returns them as SensorResponse objects."""

    query = """
    PREFIX brick: <https://brickschema.org/schema/Brick#>
    PREFIX s223: <http://data.ashrae.org/standard223#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX saref: <https://saref.etsi.org/core/>

    SELECT ?sensor ?label ?observable ?unit ?value ?space
    WHERE {
        ?sensor a brick:Sensor .
        OPTIONAL { ?sensor rdfs:label ?label }
        OPTIONAL { ?sensor brick:measures ?observable }
        OPTIONAL { ?sensor <http://qudt.org/schema/qudt/hasUnit> ?unit }
        OPTIONAL { ?sensor saref:hasValue ?value }
        OPTIONAL { ?sensor s223:isLocatedIn ?space }
    }
    ORDER BY ?label
    """

    bindings = FusekiClient.select_query(query)
    return [_to_sensor(row) for row in bindings]


def get_sensor_location(sensor_id: str) -> tuple[str | None, str | None]:
    query = f"""
    PREFIX brick: <https://brickschema.org/schema/Brick#>
    PREFIX s223: <http://data.ashrae.org/standard223#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

    SELECT ?space ?spaceLabel
    WHERE {{
        ?sensor a ?sensorType .
        FILTER(CONTAINS(LCASE(STR(?sensorType)), "sensor"))
        FILTER(STRENDS(STR(?sensor), "{sensor_id}"))
        OPTIONAL {{
        {{ ?sensor brick:isPointOf ?space . }}
        UNION
        {{ ?sensor s223:isLocatedIn ?space . }}
        OPTIONAL {{ ?space rdfs:label ?spaceLabel }}
        }}
    }}
    LIMIT 1
    """

    bindings = FusekiClient.select_query(query)
    if not bindings:
        return None, None

    row = bindings[0]
    space_uri = get_binding_value(row, "space")
    space_id = uri_to_id(space_uri) if space_uri else None
    space_name = get_binding_value(row, "spaceLabel") or space_id
    return space_id, (space_name if space_name else None)


async def get_sensor_readings(
    sensor_id: str, start_time: datetime, end_time: Optional[datetime] = None
) -> list[SensorReading]:
    """
    Read sensor readings from the database for a given sensor ID and time range.

    Args:
        sensor_id: The ID of the sensor to read from
        start_time: The timestamp to read the sensor reading for
        end_time: Optional end time to specify a range for the sensor reading (by default, it will read the latest reading at or before the start_time)
    Returns:
        A list of SensorReading objects if found, otherwise an empty list
    """
    if end_time:
        query = """
            SELECT id, time, data
            FROM sensor_readings
            WHERE id = $1 AND time >= $2 AND time <= $3
        """
        records = await TimescaleClient.fetch(query, sensor_id, start_time, end_time)
    else:
        query = """
            SELECT id, time, data
            FROM sensor_readings
            WHERE id = $1 AND time >= $2
        """
        records = await TimescaleClient.fetch(query, sensor_id, start_time)
    
    return [SensorReading(id=record['id'], timestamp=record['time'], data=record['data']) for record in records]


async def get_latest_sensor_reading(sensor_id: str) -> Optional[SensorReading]:
    """
    Get the latest sensor reading for a given sensor ID.

    Args:
        sensor_id: The ID of the sensor to read from
    Returns:
        A SensorReading object if found, otherwise None
    """
    query = """
        SELECT id, time, data
        FROM sensor_readings
        WHERE id = $1
        ORDER BY time DESC
        LIMIT 1
    """
    record = await TimescaleClient.fetchrow(query, sensor_id)
    if record is None:
        return None

    try:
        sensor_reading = SensorReading(
            id=record['id'],
            timestamp=record['time'],
            data=record['data']
        )
    except Exception as exc:
        # Log the error and return None if there's an issue with the data format
        return None
    
    return sensor_reading