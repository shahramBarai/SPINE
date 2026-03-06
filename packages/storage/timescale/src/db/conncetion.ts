import { Pool, PoolClient } from "pg";
import { logger } from "@spine/shared";

// Connection pool configuration optimised for time-series workloads
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,

    // Pool sizing
    max: 20,                        // Maximum connections in pool
    min: 5,                         // Minimum connections to maintain
    idleTimeoutMillis: 30000,       // Close idle connections after 30 seconds
    connectionTimeoutMillis: 2000,  // Maximum time to wait for a connection to be acquired
});

// Monitor pool events for debugging
pool.on('connect', () => {
    logger.info('New connection acquired');
});

pool.on('error', (err) => {
    logger.error('Unexpected error on idle client', err);
});

// Helper function for single query
async function query(text: string, params?: any[]) {
    const start = Date.now();
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    if (duration > 1000) {
        logger.warn('Slow query: ' + text + ' ' + duration + 'ms');
    }
    return result;
}

// Helper for transactions
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
