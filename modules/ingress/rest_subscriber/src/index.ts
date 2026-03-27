import { Fastify, cors, configs, excelService, kafkaProducer, schemaManager, empathicBuildingService } from "./deps";
import { logger } from "@spine/shared";
import { healthRoutes } from "./routes/health";
import { setupEmpathicBuildingHandlers } from "./utils/eb_helper";

async function setupServer() {
    const server = Fastify({
        maxParamLength: 5000,
        logger: configs.NODE_ENV === "dev"
            ? {
                transport: {
                    target: "pino-pretty",
                    options: {
                        colorize: true,
                        ignore: "pid,hostname",
                        translateTime: "HH:MM:ss.l",
                    },
                },
            } : false,
    });

    // Register error handler
    // server.register(errorHandlerPlugin);

    // Register CORS for cross-origin requests
    server.register(cors, {
        origin: true,
    });

    // Register health routes
    server.register(healthRoutes);

    // Root endpoint
    server.get("/", async () => {
        return {
            message: "REST Subscriber Service is running",
            health: "/health",
        };
    });

    // Start server
    await server.listen({ port: configs.PORT, host: configs.HOST});
}

async function main() {
    // Connect to Kafka producer and schema manager if they are initialized
    if (kafkaProducer && schemaManager) {
        logger.info("Initializing Kafka producer...");
        // TODO: Add reconnection logic in to KafkaProducerService
        await kafkaProducer.connect();
        logger.info("Kafka producer connected successfully");

        // Initialize schema manager
        await schemaManager.initialize();
        logger.info("Schema manager initialized successfully");
    }

    // Set up Empathic Building event handlers
    setupEmpathicBuildingHandlers();

    // Initialize Empathic Building service
    try {
        logger.info("Empathic Building service: Initializing...");
        await empathicBuildingService.connect();
        logger.info("Empathic Building service: Initialized successfully");
        const status = empathicBuildingService.getStatus();
        logger.info("Empathic Building service status:", status);
    } catch (error) {
        logger.warn(`Empathic Building service failed to initialize, continuing without it:`, error);
    }

    // Handle graceful shutdown
    const shutdown = async () => {
        logger.info("\n\nShutting down REST Subscriber Service...");

        // Disconnect from Empathic Building service
        try {
            await empathicBuildingService.disconnect();
        } catch (error) {
            logger.error("Error disconnecting from Empathic Building service:", error);
        }

        // Disconnect from Kafka producer if it was initialized
        if (kafkaProducer) {
            while (!await kafkaProducer.disconnect()) {
                logger.warn("Kafka producer not disconnected, retrying...");
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            logger.info("Kafka producer disconnected");
        }
        logger.info("Service shutdown complete");
        process.exit(0);
    }

    // Set up signal handlers
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}

await setupServer();
await main();