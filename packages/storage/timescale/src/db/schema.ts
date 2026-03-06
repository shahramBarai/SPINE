import { withTransaction } from "./conncetion";
import { logger } from "@spine/shared";

interface SensorReading {
    time: Date;
    id: string;
    data: JSON;
}

async function createSchema() {
    await withTransaction(async (client) => {
        // Enable TimescaleDB extension
        await client.query(`CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE`);

        // Create the base table for sensor readings (updated SensorReading interface if needed)
        await client.query(`
            CREATE TABLE IF NOT EXISTS sensor_readings (
                time        TIMESTAMPTZ NOT NULL,
                id          TEXT NOT NULL,
                data        JSONB NOT NULL
            )`
        );

        // Convert to hybertable with 1-day chunks (chunk_time_interval determines partion size);
        await client.query(`
            SELECT create_hypertable(
                'sensor_readings',
                'time',
                chunk_time_interval => INTERVAL '1 day',
                if_not_exists => TRUE
            );
        `);

        // Create indexes for common query patterns
        // Compoind index on id and time speeds up devices-specific queries
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_sensor_readings_sensor_time ON sensor_readings(id, time DESC);
        `);

        logger.info('Schema created successfully');
    });
}

export { createSchema, type SensorReading };