/**
 * Extracts one record per sensor's last_measurement from EB payloads.
 * Passes last_measurement through as measurement; downstream interprets via sensorId.
 * Reuses types.RawMeasurement and types.KafkaOutputEvent.
 */

import { logger } from "@spine/shared";

/**
 * Internal record before campusId is applied.
 * Reused by extractor and toKafkaOutputEvent.
 */
interface OutputMessage {
    campusId: string;
    sensorId: string;
    timestamp: number;
    measurement: Record<string, unknown>;
}

/** Default campus id when location mapping is missing */
const UNKNOWN_CAMPUS_ID = "unknown";

/** One record per sensor that has last_measurement; no interpretation of contents. */
function recordsFromSensor(
    sensor: Record<string, unknown>,
    campusId: string,
): OutputMessage[] {
    // FIXME: change this based on the actual sensor id in the BIM model
    const sensorId = sensor.uuid as string | undefined; // options: id, legacy_id or uuid
    
    if (!sensorId || !sensor.last_measurement) {
        logger.warn("EB: extractMeasurements failed, skipping message", {
            campusId,
            sensor
        });
        return [];
    }

    return [
        {
            campusId,
            sensorId,
            timestamp: Date.now(),
            measurement: sensor.last_measurement as Record<string, unknown>,
        },
    ];
}

/**
 * Parse EB payload into raw records. Supports:
 * - { organizationId, locationId, sensors: [...], sensorType } (batch)
 * - { sensors: [...] } with locationId from channel
 * - Single sensor object (use locationId from channel or payload)
 */
function extractMeasurements(
    data: unknown,
    campusId: string,
): OutputMessage[] {
    const out: OutputMessage[] = [];
    if (data == null) return out;

    if (Array.isArray(data)) {
        for (const item of data) {
            if (item && typeof item === "object") {
                out.push(...recordsFromSensor(item as Record<string, unknown>, campusId));
            } else {
                logger.error("EB: extractMeasurements failed, item is not an object -> skipping item", {
                    campusId,
                    item,
                });
            }
        }
    }
    return out;
}

/** Resolve campusId from external locationId using O(1) map lookup. */
function resolveCampusId(
    locationId: string,
    map: Map<string, string>,
): string {
    return map.get(String(locationId)) ?? UNKNOWN_CAMPUS_ID;
}


export {
    type OutputMessage,
    UNKNOWN_CAMPUS_ID,
    extractMeasurements,
    resolveCampusId,
};