"""
name: timescale_client.py
description: A simple client for connecting to a TimescaleDB database using asyncpg.

Provide domain-specific methods for working with sensor readings.

Public functions:
- connect: Create connection pool with specified limits
- close: Close the connection pool when done
- get_sensor_readings: Read sensor readings from the database for a given sensor ID and time range.

TODO: Move domain-specific methods to a separate class or module if the client grows significantly in scope.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel
import asyncpg

class SensorReading(BaseModel):
    id: str 
    timestamp: datetime
    data: dict

class TimescaleClient:
    """
    Simple client for connecting to a TimescaleDB database using asyncpg.

    The database URL should be in the format: "username:password@host:port/database"

    Example usage:
        client = TimescaleClient("username:password@localhost:5432/mydb")
        await client.connect()
    """
    def __init__(self, database_url: str):
        # database_url should be in the format: "username:password@host:port/database"
        self.database_url = database_url
        self.pool: Optional[asyncpg.Pool] = None

    
    async def connect(self):
        """
        Create connection pool with specified specified limits
        """
        if self.pool is not None:
            return  # Already connected
        
        # min_size: Minimum number of connections in the pool
        # max_size: Maximum number of connections in the pool
        # timeout: Connection timeout in seconds
        self.pool = await asyncpg.create_pool(
            dsn=self.database_url,
            min_size=5,
            max_size=20,
            timeout=60.0
        )

        # Ensure the timescaledb extension is available in the database
        await self._execute("CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;")

    async def close(self):
        """
        Close the connection pool when done
        """
        if self.pool:
            await self.pool.close()
            self.pool = None

    async def _execute(self, query: str, *args):
        """
        Execute a query with optional parameters and return the result.
        
        Args:
            query: SQL query string with optional placeholders for parameters
            *args: Parameters to be passed to the query
        
        Returns:
            The result of the query execution, which can be a command status 
            or a list of records depending on the query type.
        """
        if self.pool is None:
            raise RuntimeError("Database connection pool is not initialized. Call connect() first.")
        async with self.pool.acquire() as connection:
            return await connection.execute(query, *args)
        
    async def _fetch(self, query: str, *args):
        """
        Fetch all rows from a query with optional parameters.

        Args:
            query: SQL query string with optional placeholders for parameters
            *args: Parameters to be passed to the query

        Returns:
            A list of records returned by the query.
        """
        if self.pool is None:
            raise RuntimeError("Database connection pool is not initialized. Call connect() first.")
        async with self.pool.acquire() as connection:
            return await connection.fetch(query, *args)
        
    async def _fetchrow(self, query: str, *args):
        """
        Fetch a single row from a query with optional parameters.

        Args:
            query: SQL query string with optional placeholders for parameters
            *args: Parameters to be passed to the query

        Returns:
            A single record returned by the query or None if no rows are found.
        """
        if self.pool is None:
            raise RuntimeError("Database connection pool is not initialized. Call connect() first.")
        async with self.pool.acquire() as connection:
            return await connection.fetchrow(query, *args)
        
    # --- Domain-specific methods for sensor readings ---

    async def get_sensor_readings(
        self, sensor_id: str, start_time: datetime, end_time: Optional[datetime] = None
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
            records = await self._fetch(query, sensor_id, start_time, end_time)
        else:
            query = """
                SELECT id, time, data
                FROM sensor_readings
                WHERE id = $1 AND time <= $2
            """
            records = await self._fetch(query, sensor_id, start_time)
        
        return [SensorReading(id=record['id'], timestamp=record['time'], data=record['data']) for record in records]
