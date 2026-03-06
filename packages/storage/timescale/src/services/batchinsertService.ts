import { query, withTransaction } from "../db/conncetion";
import { SensorReading } from "../db/schema";
import { logger } from "@spine/shared";

class BatchInsertService {
    private batchSize: number;
    private flushInterval: number;
    private batch: SensorReading[];
    private timer: NodeJS.Timeout | null;

    constructor({ batchSize = 1000, flushInterval = 5000 }: { batchSize?: number; flushInterval?: number }) {
        this.batchSize = batchSize;
        this.flushInterval = flushInterval;
        this.batch = [];
        this.timer = null;
    }

    /**
     * Flushes the batch to the database.
     * This method is called when the batch is full or when the timer expires.
     * @throws Error if the batch cannot be flushed
     */
    private async flush() {
        if (this.batch.length === 0) return;

        const batchToInsert = [...this.batch];
        this.batch = [];

        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }

        // Build multi-row INSERT statement
        const values: string[] = [];
        const params: (Date | string | JSON)[] = [];

        batchToInsert.forEach((reading, index) => {
            const offset = index * 3;
            values.push(`($${offset + 1}, $${offset + 2}, $${offset + 3})`);
            params.push(reading.time, reading.id, reading.data);
        });

        const sql = `INSERT INTO sensor_readings (time, id, data) VALUES ${values.join(', ')}`;
        try {
            await query(sql, params);
            logger.debug('Batch flushed successfully');
        } catch (error) {
            logger.error('Failed to flush batch', error);
            // Re-add failed readings to buffer for retry
            this.batch = [...batchToInsert, ...this.batch];
            throw error;
        }
    }

    /**
     * Adds a sensor reading to the batch.
     * If the batch is full, it flushes the batch.
     * If the batch is not full, it sets a timer to flush the batch.
     * @param data.time - The time of the sensor reading.
     * @param data.id - The id of the sensor.
     * @param data.data - The data of the sensor reading
     * @throws Error if the batch cannot be flushed
     */
    addReading(data: SensorReading) {
        this.batch.push(data);

        if (this.batch.length >= this.batchSize) {
            this.flush();
        } else if (!this.timer) {
            // Set a timer to flush the batch if it's not full yet
            this.timer = setTimeout(() => this.flush(), this.flushInterval);
        }
    }

    /**
     * Gracefully shuts down the batch insert service.
     * Flushes any remaining data in the batch and clears the timer.
     * @throws Error if the batch cannot be flushed
     */
    async close() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        await this.flush();
    }
}

export { BatchInsertService };