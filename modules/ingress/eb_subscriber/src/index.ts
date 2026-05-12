import {
    Fastify,
    cors,
    configs,
    kafkaProducer,
    schemaManager,
    ebPusherService
} from "./deps";
import { logger } from "@spine/shared";
import { healthRoutes } from "./routes/health";
import { setupEmpathicBuildingHandlers } from "./utils/eb_helper";

async function setupServer() {
    const server = Fastify({
        routerOptions: {
            maxParamLength: 5000
        },
        logger:
            configs.NODE_ENV === "dev"
                ? {
                      transport: {
                          target: "pino-pretty",
                          options: {
                              colorize: true,
                              ignore: "pid,hostname",
                              translateTime: "HH:MM:ss.l"
                          }
                      }
                  }
                : false
    });

    // Register error handler
    // server.register(errorHandlerPlugin);

    // Register CORS for cross-origin requests
    server.register(cors, {
        origin: true
    });

    // Register health routes
    server.register(healthRoutes);

    // Root endpoint
    server.get("/", async () => {
        return {
            message: "REST Subscriber Service is running",
            health: "/health"
        };
    });

    // Start server
    await server.listen({ port: configs.PORT, host: configs.HOST });
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

    // Empathic Building Pusher service events (logging only - service handles reconnect)
    ebPusherService.on("connected", () => {
        logger.info("Empathic Building Pusher: connected");
    });

    ebPusherService.on("disconnected", () => {
        logger.warn("Empathic Building Pusher: disconnected");
    });

    ebPusherService.on("connectionError", (error: unknown) => {
        logger.error("Empathic Building Pusher: connection error", error);
    });

    ebPusherService.on("subscriptionError", (payload: unknown) => {
        logger.warn("Empathic Building Pusher: subscription error", payload);
    });

    // Start pusher service (it will request tokens and manage reconnects itself)
    try {
        await ebPusherService.connect();
        logger.info("Empathic Building Pusher: started");
    } catch (err) {
        logger.warn("Empathic Building Pusher: initial connect failed", err);
    }

    // Set up Empathic Building event handlers
    setupEmpathicBuildingHandlers();

    // Handle graceful shutdown
    const shutdown = async () => {
        logger.info("\n\nShutting down REST Subscriber Service...");

        // Disconnect from Empathic Building service
        try {
            await ebPusherService.disconnect();
        } catch (error) {
            logger.error(
                "Error disconnecting from Empathic Building service:",
                error
            );
        }

        // Disconnect from Kafka producer if it was initialized
        if (kafkaProducer) {
            while (!(await kafkaProducer.disconnect())) {
                logger.warn("Kafka producer not disconnected, retrying...");
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
            logger.info("Kafka producer disconnected");
        }
        logger.info("Service shutdown complete");
        process.exit(0);
    };

    // Set up signal handlers
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}

await setupServer();
await main();
