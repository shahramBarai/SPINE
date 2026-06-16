"""
name: sensor_connection_client.py
description: A client for managing WebSocket connections and routing Kafka messages to the correct clients.
"""
import asyncio
from collections import defaultdict
from aiokafka import AIOKafkaConsumer
from fastapi import WebSocket

KAFKA_BOOTSTRAP_SERVERS = "localhost:9092"
KAFKA_TOPIC = "sensor-data"

async def kafka_background_consumer():
    """
    A single, global Kafka consumer that runs in the background.
    It reads all messages and routes them to the correct connected WebSockets based on the key.
    """
    consumer = AIOKafkaConsumer(
        KAFKA_TOPIC,
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
        group_id="building-service-consumer-group",
        auto_offset_reset="latest"
    )

    await consumer.start()
    try:
        async for msg in consumer:
            if msg.key is None:
                continue
            
            sensor_id = msg.key.decode("utf-8")
            active_sockets = SensorConnectionManager.get_connections(sensor_id)
            
            if active_sockets:
                payload = msg.value.decode("utf-8")
                disconnected_sockets = []
                tasks = []
                
                for ws in active_sockets:
                    try:
                        tasks.append(ws.send_text(payload))
                    except Exception:
                        disconnected_sockets.append(ws)
                
                if tasks:
                    await asyncio.gather(*tasks, return_exceptions=True)
                    
                # Clean up any bad connections caught during broadcast
                for dead_ws in disconnected_sockets:
                    SensorConnectionManager.disconnect(sensor_id, dead_ws)
                    
    except Exception as e:
        print(f"Background Kafka consumer error: {e}")
    finally:
        await consumer.stop()

class SensorConnectionClient:
    def __init__(self):
        # The dictionary is safely contained inside the manager instance
        self._active_connections: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, sensor_id: str, websocket: WebSocket):
        await websocket.accept()
        self._active_connections[sensor_id].add(websocket)

    def disconnect(self, sensor_id: str, websocket: WebSocket):
        self._active_connections[sensor_id].discard(websocket)
        if not self._active_connections[sensor_id]:
            del self._active_connections[sensor_id]

    def get_connections(self, sensor_id: str) -> set[WebSocket]:
        """Returns a shallow copy to prevent runtime mutation errors during iteration."""
        return set(self._active_connections.get(sensor_id, []))
    

SensorConnectionManager = SensorConnectionClient()