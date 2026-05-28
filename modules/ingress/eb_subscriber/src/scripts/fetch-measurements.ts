#!/usr/bin/env tsx
/**
 * Script to fetch historical measurements for a sensor type and save them as JSON.
 *
 * Usage:
 *   tsx src/scripts/fetch-measurements.ts <organization_id> <location_id> <sensor_type> [start] [end] [output_file]
 *
 * Or with environment variables:
 *   EB_ORG_ID=10 EB_LOCATION_ID=123 EB_SENSOR_TYPE=temperature tsx src/scripts/fetch-measurements.ts
 */

import * as fs from "fs";
import * as path from "path";
import { getEmpathicBuildingConfig } from "../utils/config";
import { logger } from "../utils/logger";

type MeasurementRow = Record<string, unknown>;

interface MeasurementResponse {
    columns?: string[];
    rows?: unknown[][];
    has_more_results?: boolean;
    hasMoreResults?: boolean;
}

interface FetchMeasurementsOptions {
    start?: string;
    end?: string;
    limit?: number;
    outputFile?: string;
}

interface MeasurementExport {
    organizationId: string;
    locationId: string;
    sensorType: string;
    fetchedAt: string;
    start?: string;
    end?: string;
    totalMeasurements: number;
    pagesFetched: number;
    measurements: MeasurementRow[];
}

const DEFAULT_LIMIT = 1000;

function decodeMeasurementRow(
    columns: string[] | undefined,
    row: unknown[]
): MeasurementRow {
    if (!Array.isArray(columns) || columns.length === 0) {
        return { values: row };
    }

    return columns.reduce<MeasurementRow>((accumulator, column, index) => {
        accumulator[column] = row[index];
        return accumulator;
    }, {});
}

function getRowTimestamp(row: MeasurementRow): number | undefined {
    const candidates = [
        row.timestamp,
        row.time,
        row.created_at,
        row.createdAt,
        row.datetime,
        row.dateTime
    ];

    for (const candidate of candidates) {
        if (candidate === undefined || candidate === null) {
            continue;
        }

        if (typeof candidate === "number" && Number.isFinite(candidate)) {
            return candidate;
        }

        if (typeof candidate === "string") {
            const parsedNumber = Number(candidate);
            if (Number.isFinite(parsedNumber)) {
                return parsedNumber;
            }

            const parsedDate = Date.parse(candidate);
            if (Number.isFinite(parsedDate)) {
                return parsedDate;
            }
        }
    }

    return undefined;
}

function getMeasurementOutputPath(
    organizationId: string,
    locationId: string,
    sensorType: string,
    outputFile?: string
): string {
    if (outputFile) {
        return path.isAbsolute(outputFile)
            ? outputFile
            : path.join(process.cwd(), outputFile);
    }

    const safeSensorType = sensorType.replace(/[^a-zA-Z0-9-_]/g, "_");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    return path.join(
        process.cwd(),
        "data",
        "measurements",
        `measurements-${safeSensorType}-org${organizationId}-loc${locationId}-${timestamp}.json`
    );
}

async function authenticate(): Promise<{
    baseUrl: string;
    bearerToken: string;
}> {
    const { api: config } = getEmpathicBuildingConfig();

    const formData = new URLSearchParams();
    formData.append("email", config.username);
    formData.append("password", config.password);

    const loginResponse = await fetch(`${config.baseUrl}/v1/login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: formData.toString()
    });

    if (!loginResponse.ok) {
        const errorText = await loginResponse.text();
        throw new Error(
            `Authentication failed: ${loginResponse.status} - ${errorText}`
        );
    }

    const loginData = await loginResponse.json();
    if (!loginData?.access_token) {
        throw new Error(
            "Authentication failed: missing access token in response"
        );
    }

    return {
        baseUrl: config.baseUrl,
        bearerToken: loginData.access_token
    };
}

async function fetchAllMeasurements(
    organizationId: string,
    locationId: string,
    sensorType: string,
    options: FetchMeasurementsOptions = {}
): Promise<MeasurementExport> {
    const { baseUrl, bearerToken } = await authenticate();
    const measurements: MeasurementRow[] = [];
    const fetchedAt = new Date().toISOString();
    const limit = options.limit ?? DEFAULT_LIMIT;
    let cursorStart = options.start;
    let pagesFetched = 0;

    while (true) {
        const measurementsUrl = new URL(
            `${baseUrl}/v1/organizations/${organizationId}/locations/${locationId}/measurements/${encodeURIComponent(sensorType)}`
        );

        if (cursorStart) {
            measurementsUrl.searchParams.set("start", cursorStart);
        }

        if (options.end) {
            measurementsUrl.searchParams.set("end", options.end);
        }

        measurementsUrl.searchParams.set("limit", String(limit));
        measurementsUrl.searchParams.set("order", "asc");

        if (cursorStart && cursorStart !== options.start) {
            measurementsUrl.searchParams.set(
                "ignore_previous_validity",
                "true"
            );
        }

        logger.info(
            `Fetching measurements from: ${measurementsUrl.toString()}`
        );

        const response = await fetch(measurementsUrl.toString(), {
            method: "GET",
            headers: {
                Authorization: `Bearer ${bearerToken}`,
                Accept: "application/json"
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
                `Failed to fetch measurements: ${response.status} - ${errorText}`
            );
        }

        const payload = (await response.json()) as MeasurementResponse;
        const columns = Array.isArray(payload.columns) ? payload.columns : [];
        const rows = Array.isArray(payload.rows) ? payload.rows : [];

        if (rows.length === 0) {
            break;
        }

        pagesFetched += 1;

        for (const row of rows) {
            if (Array.isArray(row)) {
                measurements.push(decodeMeasurementRow(columns, row));
            }
        }

        const hasMoreResults =
            payload.has_more_results ?? payload.hasMoreResults ?? false;
        if (!hasMoreResults) {
            break;
        }

        const lastRow = measurements[measurements.length - 1];
        if (!lastRow) {
            throw new Error(
                "Cannot continue pagination because no decoded measurement rows are available"
            );
        }

        const lastTimestamp = getRowTimestamp(lastRow);
        if (lastTimestamp === undefined) {
            throw new Error(
                "Cannot continue pagination because the last measurement row does not contain a readable timestamp"
            );
        }

        cursorStart = String(lastTimestamp + 1);
    }

    return {
        organizationId,
        locationId,
        sensorType,
        fetchedAt,
        start: options.start,
        end: options.end,
        totalMeasurements: measurements.length,
        pagesFetched,
        measurements
    };
}

async function main() {
    const args = process.argv.slice(2);
    const normalizedArgs = args[0] === "--" ? args.slice(1) : args;

    const organizationId = normalizedArgs[0] || process.env.EB_ORG_ID;
    const locationId = normalizedArgs[1] || process.env.EB_LOCATION_ID;
    const sensorType = normalizedArgs[2] || process.env.EB_SENSOR_TYPE;
    const start = normalizedArgs[3] || process.env.EB_START;
    const end = normalizedArgs[4] || process.env.EB_END;
    const outputFile = normalizedArgs[5] || process.env.EB_OUTPUT_FILE;
    const limitValue = process.env.EB_LIMIT;
    const limit = limitValue ? Number(limitValue) : undefined;

    if (!organizationId || !locationId || !sensorType) {
        logger.error(
            "Usage: tsx src/scripts/fetch-measurements.ts <organization_id> <location_id> <sensor_type> [start] [end] [output_file]"
        );
        logger.error(
            "Or set environment variables: EB_ORG_ID, EB_LOCATION_ID, and EB_SENSOR_TYPE"
        );
        process.exit(1);
    }

    try {
        const exportData = await fetchAllMeasurements(
            organizationId,
            locationId,
            sensorType,
            {
                start,
                end,
                limit: Number.isFinite(limit) ? limit : undefined,
                outputFile
            }
        );

        const destination = getMeasurementOutputPath(
            organizationId,
            locationId,
            sensorType,
            outputFile
        );

        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.writeFileSync(
            destination,
            JSON.stringify(exportData, null, 2),
            "utf-8"
        );

        logger.info(
            `Saved ${exportData.totalMeasurements} measurement(s) to ${destination}`
        );
    } catch (error) {
        logger.error("Fatal error:", error);
        process.exit(1);
    }
}

main().catch((error) => {
    logger.error("Fatal error:", error);
    process.exit(1);
});
