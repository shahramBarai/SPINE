import { Pool, PoolClient } from "pg";
import { logger } from "@spine/shared";
import { DATABASE_URL } from "../config";

// Connection pool configuration optimised for time-series workloads
const pool = new Pool({
    connectionString: DATABASE_URL,

    // Pool sizing
    max: 20,                        // Maximum connections in pool
    min: 5,                         // Minimum connections to maintain
    idleTimeoutMillis: 30000,       // Close idle connections after 30 seconds
    connectionTimeoutMillis: 2000,  // Maximum time to wait for a connection to be acquired
});

// Monitor pool events for debugging
pool.on('connect', () => {
    logger.info('🛜  TimescaleDB: New connection acquired');
});

pool.on('error', (err) => {
    logger.error('🛜  TimescaleDB: Unexpected error on idle client', err);
});

/**
 * Executes a single query with optional parameters.
 * 
 * @param text - The SQL query to execute.
 * @param params - Optional parameters for the query.
 * @returns The result of the query.
 * 
 * @example
 * ```typescript
 * const result = await query('SELECT * FROM sensor_readings WHERE id = $1', [id]);
 * ```
 */
async function query(text: string, params?: any[]) {
    const start = Date.now();
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    if (duration > 1000) {
        logger.warn('🛜  TimescaleDB: Slow query: ' + text + ' ' + duration + 'ms');
    }
    return result;
}

/**
 * Executes a transaction with a callback function.
 * 
 * @param callback - The callback function to execute within the transaction.
 * @returns The result of the callback function.
 * @throws Error if the transaction fails.
 * 
 * @example
 * ```typescript
 * try {
 *     await withTransaction(async (client) => {
 *         await client.query('INSERT INTO sensor_readings (time, id, data) VALUES ($1, $2, $3)', [time, id, data]);
 *         await client.query('INSERT INTO sensor_readings (time, id, data) VALUES ($1, $2, $3)', [time, id, data]);
 *         ...
 *     });
 * } catch (error) {
 *     logger.error('Transaction failed', error);
 * }
 * ```
 */
async function withTransaction(callback: (client: PoolClient) => Promise<void>) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await callback(client);
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

export { pool, query, withTransaction };
