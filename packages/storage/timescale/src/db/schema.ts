import { withTransaction } from "./conncetion";
import { logger } from "@spine/shared";

interface SensorReading {
    time: Date;
    id: string;
    data: JSON;
}

/**
 * Creates the schema for the sensor readings table.
 * 
 * @returns An object containing a boolean value indicating whether
 *          the schema was created successfully and an optional error message.
 * 
 * @example
 * ```typescript
 * const { success, error } = await createSchema();
 * ```
 */
async function createSchema() {
    try {
        await withTransaction(async (client) => {
            let result;

            // Enable TimescaleDB extension
            result = await client.query(`CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE`);
            if (result.rowCount === null) {
                logger.info("✔️​  TimescaleDB extension already enabled.");
            } else {
                logger.info("✅ TimescaleDB extension enabled.");
            }

            result = await client.query(`
                CREATE TABLE IF NOT EXISTS sensor_readings (
                    time        TIMESTAMPTZ NOT NULL,
                    id          TEXT NOT NULL,
                    data        JSONB NOT NULL
                )`
            );
            if (result.rowCount === null) {
                logger.info("✔️  Table sensor_readings already exists.");
            } else {
                logger.info("✅ Table sensor_readings created.");
            }

            // Convert to hybertable with 1-day chunks (chunk_time_interval determines partion size);
            result = await client.query(`
                SELECT create_hypertable(
                    'sensor_readings',
                    'time',
                    chunk_time_interval => INTERVAL '1 day',
                    if_not_exists => TRUE
                );
            `);
            if (result.rowCount === null) {
                logger.info("✔️  Table sensor_readings already converted to hypertable with 1-day chunks.");
            } else {
                logger.info("✅ Table sensor_readings converted to hypertable with 1-day chunks.");
            }

            // Create indexes for common query patterns
            // Compoind index on id and time speeds up devices-specific queries
            result = await client.query(`
                CREATE INDEX IF NOT EXISTS idx_sensor_readings_sensor_time ON sensor_readings(id, time DESC);
            `);
            if (result.rowCount === null) {
                logger.info("✔️  Index idx_sensor_readings_sensor_time already exists.");
            } else {
                logger.info("✅ Index idx_sensor_readings_sensor_time created.");
            }
        });
    } catch (error) {
        return { success: false, error };
    }
    return { success: true, error: null };
}

export { createSchema, type SensorReading };