import * as configs from "./utils/config";
import {
    KafkaProducerService,
    ServiceSchemaManager,
    MQTTService,
} from "./services";
import { logger } from "./utils/logger";

async function main() {
    // Initialize Kafka producer
    const kafkaProducer = new KafkaProducerService();
    await kafkaProducer.connect();
    const kafkaProducerHealthStatus = await kafkaProducer.healthCheck();
    if (kafkaProducerHealthStatus.status !== "connected") {
        throw new Error(
            `Kafka producer is not connected: ${kafkaProducerHealthStatus.error}`,
        );
    }

    // Initialize schema manager
    const schemaManager = new ServiceSchemaManager();
    await schemaManager.initialize();
    const schemaManagerHealthStatus = await schemaManager.healthCheck();
    if (schemaManagerHealthStatus.status !== "connected") {
        throw new Error(
            `Schema manager is not connected: ${schemaManagerHealthStatus.error}`,
        );
    }

    // Initialize MQTT service and connect to MQTT broker (this will retry in background if it fails)
    const mqttService = new MQTTService(schemaManager, kafkaProducer);

    // Handle graceful shutdown
    const shutdown = async () => {
        logger.error("\n\nShutting down MQTT Subscriber Service...");
        // clearInterval(keepAlive);

        if (mqttService) {
            await mqttService.disconnect();
        }

        if (kafkaProducer) {
            await kafkaProducer.disconnect();
        }

        logger.debug("Service shutdown complete");
        process.exit(0);
    };

    // Set up signal handlers
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}

await main();
