"""
name: timescale_client.py
description: A simple client for connecting to a TimescaleDB database using asyncpg.

Provide domain-specific methods for working with sensor readings.

Public functions:
- connect: Create connection pool with specified limits
- close: Close the connection pool when done
- fetch: Execute a query and return the result
- fetchrow: Execute a query and return a single row
"""

from typing import Optional
import asyncpg

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
        self.database_url = f"postgresql://{database_url}"
        self.pool: Optional[asyncpg.Pool] = None

    
    async def connect(self):
        """
        Create connection pool with specified specified limits

        Raises:
            RuntimeError: If the connection pool could not be established
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

        if self.pool is None:
            raise RuntimeError("Failed to create connection pool for TimescaleDB.")

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
        Raises:
            RuntimeError: If the connection pool is not established.
        """
        if self.pool is None:
            await self.connect()
        async with self.pool.acquire() as connection:
            return await connection.execute(query, *args)
        
    async def fetch(self, query: str, *args):
        """
        Fetch all rows from a query with optional parameters.

        Args:
            query: SQL query string with optional placeholders for parameters
            *args: Parameters to be passed to the query
        Returns:
            A list of records returned by the query.
        Raises:
            RuntimeError: If the connection pool could not be established.
        """
        if self.pool is None:
            await self.connect()
        async with self.pool.acquire() as connection:
            return await connection.fetch(query, *args)
        
    async def fetchrow(self, query: str, *args):
        """
        Fetch a single row from a query with optional parameters.

        Args:
            query: SQL query string with optional placeholders for parameters
            *args: Parameters to be passed to the query
        Returns:
            A single record returned by the query or None if no rows are found.
        Raises:
            RuntimeError: If the connection pool could not be established.
        """
        if self.pool is None:
            await self.connect()
        async with self.pool.acquire() as connection:
            return await connection.fetchrow(query, *args)
