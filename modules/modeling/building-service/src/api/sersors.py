
from __future__ import annotations

from dataclasses import asdict
from datetime import datetime
from typing import Optional
import asyncio
import json
import os
import uuid

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from deps import FusekiSparqlError
from services import SensorService

router = APIRouter(tags=["Sensors"])

try:
    from aiokafka import AIOKafkaConsumer
except ImportError:  # pragma: no cover - optional dependency in local dev
    AIOKafkaConsumer = None

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


class SensorLiveUpdate(BaseModel):
    sensor_id: str
    latest_value: str | None
    latest_time: str | None
    source: str


def _extract_rows_from_kafka_payload(payload: dict) -> list[dict]:
    if isinstance(payload.get("measurements"), list):
        return [row for row in payload["measurements"] if isinstance(row, dict)]

    if isinstance(payload.get("measurement"), dict):
        sensor_id = payload.get("sensorId") or payload.get("sensor_id") or payload.get("id")
        timestamp = payload.get("timestamp") or payload.get("time") or payload.get("fetchedAt")
        row = dict(payload["measurement"])
        if sensor_id is not None:
            row.setdefault("sensor_id", sensor_id)
        if timestamp is not None:
            row.setdefault("time", timestamp)
        return [row]

    return []


def _to_iso_timestamp(raw_time: object) -> str | None:
    if raw_time is None:
        return None

    if isinstance(raw_time, (int, float)):
        ts = float(raw_time)
        if ts > 1e11:
            ts /= 1000.0
        return datetime.utcfromtimestamp(ts).isoformat() + "Z"

    if isinstance(raw_time, str):
        return raw_time

    return None


@router.get("/api/sensors/{sensor_id}/stream")
async def stream_sensor_updates(sensor_id: str):
    async def event_stream():
        if AIOKafkaConsumer is None:
            error_payload = SensorLiveUpdate(
                sensor_id=sensor_id,
                latest_value=None,
                latest_time=None,
                source="kafka",
            )
            yield "event: error\n"
            yield f"data: {error_payload.model_dump_json()}\n\n"
            return

        bootstrap_servers = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
        topic = os.getenv("KAFKA_TOPIC_SENSOR_DATA", "sensor-data")

        consumer = AIOKafkaConsumer(
            topic,
            bootstrap_servers=bootstrap_servers,
            group_id=f"building-service-live-{uuid.uuid4()}",
            enable_auto_commit=True,
            auto_offset_reset="latest",
            value_deserializer=lambda value: json.loads(value.decode("utf-8")),
        )

        await consumer.start()
        try:
            while True:
                try:
                    msg = await asyncio.wait_for(consumer.getone(), timeout=15.0)
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
                    continue

                payload = msg.value if isinstance(msg.value, dict) else {}
                rows = _extract_rows_from_kafka_payload(payload)

                for row in rows:
                    row_sensor_id = str(
                        row.get("sensor_id")
                        or row.get("sensorId")
                        or row.get("id")
                        or ""
                    )
                    if row_sensor_id != sensor_id:
                        continue

                    update = SensorLiveUpdate(
                        sensor_id=sensor_id,
                        latest_value=None if row.get("value") is None else str(row.get("value")),
                        latest_time=_to_iso_timestamp(row.get("time") or row.get("timestamp") or row.get("fetchedAt")),
                        source="kafka",
                    )
                    yield "event: sensor_update\n"
                    yield f"data: {update.model_dump_json()}\n\n"
        finally:
            await consumer.stop()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

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
        readings = await SensorService.get_sensor_readings(sensor_id, start_time, end_time)
    except FusekiSparqlError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    
    return readings