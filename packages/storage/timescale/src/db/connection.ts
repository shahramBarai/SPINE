import { Pool, type PoolClient } from "pg";
import { logger } from "@spine/shared";
import { type TimescaleConfig } from "../config";

let pool: Pool | null = null;

/**
 * Initialise the TimescaleDB connection pool.
 * Must be called once at service startup before any queries.
 */
function initTimescaleStorage(config: TimescaleConfig): void {
    if (pool) {
        return; // already initialised
    }

    pool = new Pool({
        connectionString: config.databaseUrl,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    });

    pool.on("connect", () => {
        logger.info("🛜  TimescaleDB: New connection acquired");
    });

    pool.on("error", (err) => {
        logger.error("🛜  TimescaleDB: Unexpected error on idle client", err);
    });
}

function getPool(): Pool {
    if (!pool) {
        throw new Error(
            "TimescaleDB pool not initialised. Call initDb() first."
        );
    }
    return pool;
}

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
async function query(text: string, params?: unknown[]) {
    const start = Date.now();
    const result = await getPool().query(text, params);
    const duration = Date.now() - start;

    if (duration > 1000) {
        logger.warn(
            "🛜  TimescaleDB: Slow query: " + text + " " + duration + "ms"
        );
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
 *     });
 * } catch (error) {
 *     logger.error('Transaction failed', error);
 * }
 * ```
 */
async function withTransaction(
    callback: (client: PoolClient) => Promise<void>
) {
    const client = await getPool().connect();
    try {
        await client.query("BEGIN");
        await callback(client);
        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export { initTimescaleStorage, getPool, query, withTransaction };
