import { query } from "../db/conncetion";
import { SensorReading } from "../db/schema";

/* -------------------------------- CREATE -------------------------------- */

/**
 * Inserts a single sensor reading into the database.
 * 
 * NOTE: This method is not recommended for use in production.
 * Use BatchInsertService instead for better performance.
 * 
 * @param data - The sensor reading to insert.
 * @returns The inserted sensor reading.
 * @throws Error if the sensor reading cannot be inserted.
 */
async function insertSensorData(data: SensorReading) {
    const queryText = `
        INSERT INTO sensor_readings (time, id, data)
        VALUES ($1, $2, $3)
        RETURNING *;
    `;

    const res = await query(queryText, [data.time, data.id, data.data]);

    return res.rows[0];
}

/* -------------------------------- READ -------------------------------- */

/**
 * Retrieves sensor data for a specific sensor within a given time range.
 * @param id - The ID of the sensor.
 * @param timeRange - The time range to retrieve data for.
 * @returns The sensor data.
 * @throws Error if the sensor data cannot be retrieved.
 */
async function getSensorData(id: string, timeRange: { start: Date, end: Date }) {
    const queryText = `
        SELECT * FROM sensor_readings
        WHERE id = $1 AND time BETWEEN $2 AND $3
        ORDER BY time ASC;
    `;

    const res = await query(queryText, [id, timeRange.start, timeRange.end]);

    return res.rows;
}


export { insertSensorData, getSensorData };