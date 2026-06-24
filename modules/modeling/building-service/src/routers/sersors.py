
from __future__ import annotations

from dataclasses import asdict
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from db.sensor_connection_client import SensorConnectionManager
from deps import FusekiSparqlError
from services import SensorService

router = APIRouter(tags=["Sensors"])

@router.get("/api/sensors", response_model=list[SensorService.SensorSummary])
def get_sensors(dataset_name: str) -> list[SensorService.SensorSummary]:
    try:
        sensors = SensorService.read_sensors(dataset_name=dataset_name)
    except FusekiSparqlError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return sensors

class SensorInfoResponse(BaseModel):
    id: str
    location_id: str | None
    location_name: str | None
    latest_value: str | None
    latest_time: str | None
    telemetry_error: str | None

@router.get("/api/sensors/{sensor_id}/info", response_model=SensorInfoResponse)
async def get_sensor_information(dataset_name: str, sensor_id: str) -> SensorInfoResponse:
    """
    Retrieve the latest sensor reading and location information for a given sensor ID.

    **Args**
        sensor_id: The ID of the sensor to retrieve information for
    **Returns**
        A SensorInfoResponse object containing the sensor's location and latest reading information
    """
    try:
        location_id, location_name = await SensorService.read_sensor_location(dataset_name=dataset_name, sensor_id=sensor_id)
        latest_reading = await SensorService.read_latest_sensor_reading(sensor_id)
    except FusekiSparqlError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    
    telemetry_error = None
    if location_id is None and location_name is None and latest_reading is None:
        telemetry_error = "No sensor data available for the given sensor ID"
    elif location_id is None and location_name is None:
        telemetry_error = "No location data available for the given sensor ID"
    elif latest_reading is None:
        telemetry_error = "No sensor readings available for the given sensor ID"

    selection = SensorInfoResponse(
        id=latest_reading.id if latest_reading else sensor_id,
        location_id=location_id,
        location_name=location_name,
        latest_value=str(latest_reading.data.get("value")) if latest_reading.data else None,
        latest_time=latest_reading.timestamp.isoformat() if latest_reading.timestamp else None,
        telemetry_error=telemetry_error
    )
    return selection


@router.get("/api/sensors/{sensor_id}/readings", response_model=list[SensorService.SensorReading])
async def get_sensor_readings(sensor_id: str, start_time: Optional[datetime] = None, end_time: Optional[datetime] = None) -> list[SensorService.SensorReading]:
    """
    Read sensor readings from the database for a given sensor ID and time range.

    **Args**
        sensor_id: The ID of the sensor to read from
        start_time: Optional lower timestamp bound (ISO 8601 format)
        end_time: Optional upper timestamp bound (ISO 8601 format)
    **Returns**
        A list of SensorReading objects if found, otherwise an empty list
    """
    try:
        readings = await SensorService.read_sensor_readings(sensor_id, start_time, end_time)
    except FusekiSparqlError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    
    return readings

### ----- WebSocket endpoint for real-time sensor updates -----

@router.websocket("/ws/sensor/{sensor_id}")
async def websocket_endpoint(websocket: WebSocket, sensor_id: str):
    await SensorConnectionManager.connect(sensor_id, websocket)
    try:
        while True:
            # Keep connection alive; wait for incoming client text if necessary
            await websocket.receive_text() 
    except WebSocketDisconnect:
        pass
    finally:
        SensorConnectionManager.disconnect(sensor_id, websocket)