import { withTransaction } from "./connection";
import { logger } from "@spine/shared";

interface SensorReading {
    time: Date;
    id: string;
    data: Record<string, unknown>;
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
            // Enable TimescaleDB extension
            await client.query(
                `CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE`
            );
            logger.info("✅ Ensured TimescaleDB extension exists.");

            await client.query(`
                CREATE TABLE IF NOT EXISTS sensor_readings (
                    time        TIMESTAMPTZ NOT NULL,
                    id          TEXT NOT NULL,
                    data        JSONB NOT NULL
                )`);
            logger.info("✅ Ensured table sensor_readings exists.");

            // Convert to hypertable with 1-day chunks (chunk_time_interval determines partition size)
            await client.query(`
                SELECT create_hypertable(
                    'sensor_readings',
                    'time',
                    chunk_time_interval => INTERVAL '1 day',
                    if_not_exists => TRUE
                );
            `);
            logger.info(
                "✅ Ensured table sensor_readings is converted to hypertable with 1-day chunks."
            );

            // Create indexes for common query patterns
            // Compound index on id and time speeds up devices-specific queries
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_sensor_readings_sensor_time ON sensor_readings(id, time DESC);
            `);
            logger.info(
                "✅ Ensured index idx_sensor_readings_sensor_time exists."
            );
        });
    } catch (error) {
        return { success: false, error };
    }
    return { success: true, error: null };
}

export { createSchema, type SensorReading };
