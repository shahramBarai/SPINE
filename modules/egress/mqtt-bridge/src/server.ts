import {
    KafkaConsumer,
    MQTTClient,
} from "./deps";
import { logger } from "@spine/shared";

async function kafkaConsumerMessageHandler(message: string, topic: string, partition: number, offset: string) {
    try {
        // Parse message
        const messageData = JSON.parse(message);

        if (!messageData.campusId || !messageData.sensorId || !messageData.measurement) {
            logger.warn("MQTT bridge service: Missing required fields in message -> skipping message", {
                messageData,
            });
            return;
        }

        const topic = `${messageData.campusId}/${messageData.sensorId}`;
        const messageOutput = JSON.stringify(messageData.measurement);

        // Publish to MQTT (if enabled)
        if (MQTTClient.isEnabled()) {
            await MQTTClient.publish(topic, messageOutput);
        }

        // Log successful processing
        logger.debug(`MQTT bridge service: Processed message for topic ${topic}`);
    } catch (error) {
        logger.error("MQTT bridge service: Error processing Kafka message:", error);
    }
}

async function main() {
    // Set up message handler for Kafka consumer to distribute to all protocols
    KafkaConsumer.setMessageHandler(kafkaConsumerMessageHandler);

    // Connect to Kafka consumer
    logger.info("MQTT bridge service: Connecting to Kafka...");
    if (!(await KafkaConsumer.connect())) {
        throw new Error("Kafka consumer failed to connect!");
    }
    logger.info("MQTT bridge service: Kafka consumer connected");


    // Connect to MQTT broker
    logger.info("MQTT bridge service: Connecting to MQTT broker...");
    if (!(await MQTTClient.connect())) {
        logger.warn("Gateway service: MQTT gateway failed to connect, continuing without MQTT");
    } else {
        logger.info("MQTT bridge service: MQTT gateway connected");
    }

    // Handle graceful shutdown
    const shutdown = async () => {
        logger.info("\n\nShutting down MQTT bridge service...");

        // Disconnect from Kafka
        await KafkaConsumer.disconnect();
        logger.info("MQTT bridge service: Kafka consumer disconnected");

        // Disconnect from MQTT
        await MQTTClient.disconnect();
        logger.info("Gateway service: MQTT gateway disconnected");

        logger.info("MQTT bridge service: Shutdown complete");
        process.exit(0);
    };

    // Set up signal handlers
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}

await main();
