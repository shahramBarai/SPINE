#!/usr/bin/env tsx
/**
 * Import exported measurement JSON files into TimescaleDB.
 *
 * Usage:
 *   tsx scripts/import-measurements.ts <file-or-directory> [more files or directories...]
 *
 * The script accepts the JSON produced by modules/ingress/eb_subscriber/src/scripts/fetch-measurements.ts.
 */
 
import dotenv from "dotenv";
import * as fs from "fs";
import * as net from "net";
import * as path from "path";
import { fileURLToPath } from "url";
import { initTimescaleStorage } from "../src/db/connection";
import { createSchema, type SensorReading } from "../src/db/schema";
import { logger } from "../src/logger";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../../../../");

dotenv.config({
    path: [path.join(repoRoot, ".env"), path.join(repoRoot, ".env.example")]
});
 
type MeasurementRow = Record<string, unknown>;
 
interface MeasurementExportFile {
    measurements?: unknown[];
    rows?: unknown[];
    columns?: string[];
    organizationId?: string;
    locationId?: string;
    sensorType?: string;
}
 
const BATCH_SIZE = 1000;
const DEFAULT_INPUT_FOLDER =
    process.env.MEASUREMENT_IMPORT_INPUT_FOLDER ??
    "C:\\Users\\yanpe\\OneDrive - Metropolia Ammattikorkeakoulu Oy\\Research\\MD2MV\\data\\Sensors\\history";

function resolveInputPaths(argv: string[]): string[] {
    if (argv.length > 0) {
        return argv.map((input) => path.resolve(process.cwd(), input));
    }

    return [path.resolve(DEFAULT_INPUT_FOLDER)];
}

function assertTcpPortReachable(host: string, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
        const socket = net.createConnection({ host, port });

        socket.setTimeout(1000);
        socket.once("connect", () => {
            socket.end();
            resolve();
        });
        socket.once("timeout", () => {
            socket.destroy();
            reject(new Error(`Timed out connecting to ${host}:${port}`));
        });
        socket.once("error", (error) => {
            socket.destroy();
            reject(error);
        });
    });
}

async function ensureTimescaleReachable(databaseUrl: string): Promise<void> {
    const url = new URL(databaseUrl);
    const host = url.hostname;
    const port = Number(url.port || "5432");

    if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
        return;
    }

    try {
        await assertTcpPortReachable(host, port);
    } catch {
        throw new Error(
            `TimescaleDB is not reachable at ${host}:${port}. Start it with \`docker compose -f modules/storage/docker-compose.dev.yml up -d timescaledb\` or update DATABASE_URL_TIMESCALE to the correct host and port.`
        );
    }
}
 
function toDate(value: unknown): Date | null {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }
 
    if (typeof value === "number" && Number.isFinite(value)) {
        const millis = value < 1e12 ? value * 1000 : value;
        const date = new Date(millis);
        return Number.isNaN(date.getTime()) ? null : date;
    }
 
    if (typeof value === "string" && value.trim()) {
        const numericValue = Number(value);
        if (Number.isFinite(numericValue)) {
            return toDate(numericValue);
        }
 
        const parsed = Date.parse(value);
        if (Number.isFinite(parsed)) {
            const date = new Date(parsed);
            return Number.isNaN(date.getTime()) ? null : date;
        }
    }
 
    return null;
}
 
function decodeRows(
    columns: string[],
    rows: unknown[][]
): Record<string, unknown>[] {
    return rows.map((row) =>
        columns.reduce<Record<string, unknown>>(
            (accumulator, column, index) => {
                accumulator[column] = row[index];
                return accumulator;
            },
            {}
        )
    );
}
 
function loadMeasurementRows(filePath: string): MeasurementRow[] {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as MeasurementExportFile | unknown[];
 
    if (Array.isArray(parsed)) {
        return parsed.filter((value): value is MeasurementRow =>
            Boolean(value)
        );
    }
 
    if (Array.isArray(parsed.measurements)) {
        return parsed.measurements.filter((value): value is MeasurementRow =>
            Boolean(value)
        );
    }
 
    if (Array.isArray(parsed.rows)) {
        if (parsed.rows.length === 0) {
            return [];
        }
 
        if (Array.isArray(parsed.columns) && parsed.columns.length > 0) {
            return decodeRows(parsed.columns, parsed.rows as unknown[][]);
        }
 
        return parsed.rows.filter((value): value is MeasurementRow =>
            Boolean(value)
        );
    }
 
    throw new Error(`Unsupported measurement file format: ${filePath}`);
}
 
function pickReadingId(
    row: Record<string, unknown>,
    sourceFile: string,
    rowIndex: number
): string {
    const candidateKeys = [
        "id",
        "sensor_id",
        "sensorId",
        "sensor",
        "device_id",
        "deviceId",
        "asset_id",
        "assetId",
        "measurement_id",
        "measurementId",
        "uuid"
    ];
 
    for (const key of candidateKeys) {
        const candidate = row[key];
        if (typeof candidate === "string" && candidate.trim()) {
            return candidate;
        }
        if (typeof candidate === "number" && Number.isFinite(candidate)) {
            return String(candidate);
        }
    }
 
    return `${path.basename(sourceFile)}:${rowIndex}`;
}
 
function pickReadingTime(row: Record<string, unknown>): Date {
    const candidateKeys = [
        "time",
        "timestamp",
        "created_at",
        "createdAt",
        "datetime",
        "dateTime"
    ];
 
    for (const key of candidateKeys) {
        const parsed = toDate(row[key]);
        if (parsed) {
            return parsed;
        }
    }
 
    throw new Error(
        `Unable to determine measurement time for row: ${JSON.stringify(row)}`
    );
}
 
function toSensorReading(
    row: Record<string, unknown>,
    sourceFile: string,
    rowIndex: number
): SensorReading {
    const time = pickReadingTime(row);
    const id = pickReadingId(row, sourceFile, rowIndex);
    const data = { ...row };
 
    delete data.time;
    delete data.timestamp;
    delete data.created_at;
    delete data.createdAt;
    delete data.datetime;
    delete data.dateTime;
    delete data.id;
    delete data.sensor_id;
    delete data.sensorId;
 
    return { time, id, data };
}
 
function flattenInputs(inputs: string[]): string[] {
    const files: string[] = [];
 
    for (const input of inputs) {
        if (!fs.existsSync(input)) {
            throw new Error(`Input path does not exist: ${input}`);
        }
 
        const stats = fs.statSync(input);
        if (stats.isDirectory()) {
            const directoryFiles = fs
                .readdirSync(input)
                .filter((entry) => entry.endsWith(".json"))
                .map((entry) => path.join(input, entry));
            files.push(...directoryFiles);
        } else {
            files.push(input);
        }
    }
 
    return files;
}
 
async function insertReadings(readings: SensorReading[]) {
    const connection = await import("../src/db/connection");
 
    await connection.withTransaction(async (client) => {
        for (let index = 0; index < readings.length; index += BATCH_SIZE) {
            const batch = readings.slice(index, index + BATCH_SIZE);
            const values: string[] = [];
            const params: unknown[] = [];
 
            batch.forEach((reading, batchIndex) => {
                const offset = batchIndex * 3;
                values.push(`($${offset + 1}, $${offset + 2}, $${offset + 3})`);
                params.push(reading.time, reading.id, reading.data);
            });
 
            await client.query(
                `INSERT INTO sensor_readings (time, id, data) VALUES ${values.join(", ")}`,
                params
            );
        }
    });
}
 
async function main() {
    const inputPaths = resolveInputPaths(process.argv.slice(2));

    logger.info(`Using input path(s): ${inputPaths.join(", ")}`);

    const databaseUrl = process.env.DATABASE_URL_TIMESCALE;
    if (!databaseUrl) {
        throw new Error(
            "DATABASE_URL_TIMESCALE is not set. Set it in .env or rely on .env.example."
        );
    }

    await ensureTimescaleReachable(`postgresql://${databaseUrl}`);
 
    initTimescaleStorage({
        databaseUrl: `postgresql://${databaseUrl}`
    });
 
    const schemaResult = await createSchema();
    if (!schemaResult.success) {
        throw schemaResult.error;
    }
 
    const inputFiles = flattenInputs(inputPaths);
    if (inputFiles.length === 0) {
        logger.warn("No JSON files found to import.");
        return;
    }
 
    const readings: SensorReading[] = [];
 
    for (const filePath of inputFiles) {
        const rows = loadMeasurementRows(filePath);
        rows.forEach((row, rowIndex) => {
            readings.push(toSensorReading(row, filePath, rowIndex));
        });
        logger.info(`Loaded ${rows.length} measurement(s) from ${filePath}`);
    }
 
    if (readings.length === 0) {
        logger.warn("No measurements found in the provided file(s).");
        return;
    }
 
    await insertReadings(readings);
    logger.info(`Imported ${readings.length} measurement(s) into TimescaleDB.`);
}
 
main().catch((error) => {
    logger.error("Fatal error:", error);
    process.exit(1);
});