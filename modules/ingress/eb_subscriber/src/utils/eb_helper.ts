/**
 * Helper functions for Empathic Building service
 * Contains Functions:
 * - handleEmpathicBuildingEvent: Handle incoming Empathic Building events and route to configured destination (Kafka, Excel or just log to console)
 * - setupEmpathicBuildingHandlers: Set up Empathic Building event handlers (connection events, event handlers, error handlers, etc.)
 */

import { logger } from "../utils/logger";
import { ebPusherService, kafkaProducer, excelService, configs } from "../deps";
import type { DecodedEvent } from "./eb_types";
import {
    extractMeasurements,
    resolveCampusId,
    UNKNOWN_CAMPUS_ID
} from "./extractor";

/** Extract external locationId from Pusher channel name, e.g. "private-location-7" -> "7" */
function locationIdFromChannel(channel: string): string {
    const prefix = "private-location-";
    return channel.startsWith(prefix) ? channel.slice(prefix.length) : "";
}

/**
 * Handle incoming Empathic Building events and route to configured destination.
 */
async function handleEmpathicBuildingEvent(event: DecodedEvent): Promise<void> {
    const legacyMessage = {
        eventType: event.eventType,
        channel: event.channel,
        data: event.data,
        timestamp: event.timestamp,
        source: "empathic-building"
    };

    const locationIdFromCh = locationIdFromChannel(event.channel);
    const campusId = resolveCampusId(
        locationIdFromCh,
        configs.getLocationToCampusMap()
    );

    let outputMessages;
    try {
        outputMessages = extractMeasurements(event.data, campusId);
    } catch (err) {
        logger.warn("EB: extractMeasurements failed, skipping message", {
            err,
            eventType: event.eventType,
            channel: event.channel
        });
        return;
    }

    for (const outMsg of outputMessages) {
        if (campusId === UNKNOWN_CAMPUS_ID) {
            logger.debug(
                "EB: missing location->campus mapping, using unknown",
                {
                    locationId: outMsg.campusId
                }
            );
        }

        try {
            if (kafkaProducer) {
                await kafkaProducer.sendMessage({
                    key: outMsg.sensorId,
                    value: JSON.stringify(outMsg)
                });
                logger.debug("EB: sensor event sent to Kafka", outMsg);
            } else if (excelService) {
                await excelService.saveEvent(legacyMessage);
                logger.debug("EB: sensor event sent to Excel", outMsg);
            } else {
                logger.info(JSON.stringify(outMsg));
            }
        } catch (err) {
            logger.error("EB: Kafka produce failed", {
                err,
                outMsg
            });
            throw err;
        }
    }
}

/**
 * Set up Empathic Building event handlers
 */
function setupEmpathicBuildingHandlers(): void {
    // Handle specific event types (optional - for additional logging/processing)
    ebPusherService.on("sensor-modified", async (event: DecodedEvent) => {
        logger.debug("EB: Received sensor-modified event", {
            channel: event.channel,
            timestamp: event.timestamp
        });
        await handleEmpathicBuildingEvent(event);
    });

    ebPusherService.on("eventError", (eventError: unknown) => {
        logger.debug("EB: event decoding/handling error observed", {
            eventError
        });
    });
}

export { setupEmpathicBuildingHandlers };
