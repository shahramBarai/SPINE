
from __future__ import annotations

from dataclasses import asdict
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from deps import FusekiSparqlError
from services import SensorService

router = APIRouter(tags=["Sensors"])

@router.get("/api/sensors", response_model=list[SensorService.SensorSummary])
def get_sensors() -> list[SensorService.SensorSummary]:
    try:
        sensors = SensorService.get_sensors()
    except FusekiSparqlError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return sensors

class SensorSelection(BaseModel):
    id: str
    location_id: str | None
    location_name: str | None
    latest_value: str | None
    latest_time: str | None
    telemetry_error: str | None

@router.get("/api/sensors/{sensor_id}/selection", response_model=SensorSelection)
async def get_sensor_selection(sensor_id: str) -> SensorSelection:
    try:
        location_id, location_name = SensorService.get_sensor_location(sensor_id)
        latest_reading = await SensorService.get_latest_sensor_reading(sensor_id)
    except FusekiSparqlError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    
    telemetry_error = None
    if location_id is None and location_name is None and latest_reading is None:
        telemetry_error = "No sensor data available for the given sensor ID"
    elif location_id is None and location_name is None:
        telemetry_error = "No location data available for the given sensor ID"
    elif latest_reading is None:
        telemetry_error = "No sensor readings available for the given sensor ID"

    selection = SensorSelection(
        id=latest_reading.id if latest_reading else sensor_id,
        location_id=location_id,
        location_name=location_name,
        latest_value=str(latest_reading.data.get("value")) if latest_reading.data else None,
        latest_time=latest_reading.timestamp.isoformat() if latest_reading.timestamp else None,
        telemetry_error=telemetry_error
    )   
    return selection


@router.get("/api/sensors/{sensor_id}/readings", response_model=list[SensorService.SensorReading])
async def get_sensor_readings(sensor_id: str, start_time: datetime, end_time: Optional[datetime] = None) -> list[SensorService.SensorReading]:
    """
    Read sensor readings from the database for a given sensor ID and time range.

    **Args**
        sensor_id: The ID of the sensor to read from
        start_time: The timestamp to read the sensor reading for (ISO 8601 format)
        end_time: Optional end time to specify a range for the sensor reading (by default, it will read the latest reading at or before the start_time)
    **Returns**
        A list of SensorReading objects if found, otherwise an empty list
    """
    try:
        readings = await SensorService.get_sensor_readings(sensor_id, start_time, end_time)
    except FusekiSparqlError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    
    return readings