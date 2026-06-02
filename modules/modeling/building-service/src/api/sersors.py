
from __future__ import annotations

from typing import Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from deps import get_fuseki_client, FusekiSparqlError, get_timescale_client
from utils.sparql_helpers import get_binding_value, uri_to_id

router = APIRouter(tags=["Sensors"])

fuseki_sparql_client = get_fuseki_client()

class SensorResponse(BaseModel):
	id: str
	name: str
	kind: str
	status: str
	value: float
	unit: str
	bound: str
	
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

def _to_sensor(binding: dict[str, Any]) -> SensorResponse:
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

	return SensorResponse(
		id=uri_to_id(sensor_uri),
		name=label,
		kind=fallback_kind,
		status="live",
		value=value,
		unit=unit or fallback_unit,
		bound=uri_to_id(bound_uri),
	)

# TODO: Move the logic to a service layer and handle any errors there.
@router.get("/api/sensors", response_model=list[SensorResponse])
def get_sensors() -> list[SensorResponse]:
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
	try:
		bindings = fuseki_sparql_client.select_query(query)
	except FusekiSparqlError as exc:
		raise HTTPException(status_code=502, detail=str(exc)) from exc

	return [_to_sensor(row) for row in bindings]

class SensorSelectionDto(BaseModel):
	id: str
	location_id: str | None = None
	location_name: str | None = None
	latest_value: str | None = None
	latest_time: str | None = None
	telemetry_error: str | None = None

# TODO: Move the logic to a service layer and handle any errors there.
def _resolve_sensor_location(sensor_id: str) -> tuple[str | None, str | None]:
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

	try:
		bindings = fuseki_sparql_client.select_query(query)
	except FusekiSparqlError:
		return None, None

	if not bindings:
		return None, None

	row = bindings[0]
	space_uri = get_binding_value(row, "space")
	space_id = uri_to_id(space_uri) if space_uri else None
	space_name = get_binding_value(row, "spaceLabel") or space_id
	return space_id, (space_name if space_name else None)

@router.get("/api/sensors/{sensor_id}/selection", response_model=SensorSelectionDto)
async def get_sensor_selection(sensor_id: str) -> SensorSelectionDto:
	location_id, location_name = _resolve_sensor_location(sensor_id)
	# TODO: Add logic to fetch latest telemetry value and time for the sensor, and handle any errors that may occur during that process. For now, we will return None for those fields.
	latest_value, latest_time, telemetry_error = None, None, None

	timescale_client = await get_timescale_client()
	results = await timescale_client.get_latest_sensor_reading(sensor_id=sensor_id)

	return SensorSelectionDto(
		id=sensor_id,
		location_id=location_id,
		location_name=location_name,
		latest_value=latest_value,
		latest_time=latest_time,
		telemetry_error=telemetry_error,
	)