/**
 * Helper functions for Empathic Building service
 * Contains Functions:
 * - handleEmpathicBuildingEvent: Handle incoming Empathic Building events and route to configured destination (Kafka, Excel or just log to console)
 * - setupEmpathicBuildingHandlers: Set up Empathic Building event handlers (connection events, event handlers, error handlers, etc.)
 */

import { logger } from "@spine/shared";
import { empathicBuildingService, kafkaProducer, excelService } from "../deps";
import type { DecodedEvent } from "@spine/ingress";

/**
 * Handle incoming Empathic Building events and route to configured destination
 */
async function handleEmpathicBuildingEvent(event: DecodedEvent): Promise<void> {
    try {
        // Prepare message data
        const message = {
            eventType: event.eventType,
            channel: event.channel,
            data: event.data,
            timestamp: event.timestamp,
            source: "empathic-building",
        };

        // Route data based on SEND_TO configuration
        if (kafkaProducer) {
            // Send to Kafka
            const messageString = JSON.stringify(message);
            await kafkaProducer.sendMessage(messageString);
            logger.debug(
                `Empathic Building: Sent event ${event.eventType} to Kafka`,
            );
        } else if (excelService) {
            // Save to Excel file
            await excelService.saveEvent(message);
            logger.debug(
                `Empathic Building: Saved event ${event.eventType} to Excel`,
            );
        } else {
            // Log to console
            const messageString = JSON.stringify(message);
            logger.info(messageString);
        }
    } catch (error) {
        logger.error(
            `Empathic Building: Failed to process event ${event.eventType}:`,
            error,
        );
    }
}

/**
 * Set up Empathic Building event handlers
 */
function setupEmpathicBuildingHandlers(): void {
    // Connection events
    empathicBuildingService.on("connected", () => {
        logger.info("Empathic Building service: Connected to Pusher");
    });

    empathicBuildingService.on("disconnected", () => {
        logger.warn("Empathic Building service: Disconnected from Pusher");
    });

    empathicBuildingService.on("subscribed", ({ channel }) => {
        logger.info(`Empathic Building service: Subscribed to channel ${channel}`);
    });

    // Handle all events and route to configured destination
    empathicBuildingService.on("event", async (event: DecodedEvent) => {
        await handleEmpathicBuildingEvent(event);
    });

    // Handle specific event types (optional - for additional logging/processing)
    empathicBuildingService.on("sensor-modified", async (event: DecodedEvent) => {
        logger.debug("Empathic Building: Sensor modified event received");
        await handleEmpathicBuildingEvent(event);
    });

    empathicBuildingService.on("asset-created", async (event: DecodedEvent) => {
        logger.debug("Empathic Building: Asset created event received");
        await handleEmpathicBuildingEvent(event);
    });

    empathicBuildingService.on("asset-modified", async (event: DecodedEvent) => {
        logger.debug("Empathic Building: Asset modified event received");
        await handleEmpathicBuildingEvent(event);
    });

    empathicBuildingService.on("asset-deleted", async (event: DecodedEvent) => {
        logger.debug("Empathic Building: Asset deleted event received");
        await handleEmpathicBuildingEvent(event);
    });

    // Error handling
    empathicBuildingService.on("error", (error: unknown) => {
        logger.error("Empathic Building service error:", error);
    });

    empathicBuildingService.on("tokenRefreshError", (error: unknown) => {
        logger.error("Empathic Building token refresh error:", error);
    });
}

export { setupEmpathicBuildingHandlers };