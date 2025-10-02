import * as configs from "./utils/config";
import {
    Fastify,
    cors,
    KafkaProducer,
    SchemaManager,
    MqttService,
} from "./deps";
import { logger } from "./utils/logger";
import { healthRoutes } from "./routes/health";

async function setupServer() {
    const server = Fastify({
        maxParamLength: 5000,
        logger:
            configs.NODE_ENV === "dev"
                ? {
                      transport: {
                          target: "pino-pretty",
                          options: {
                              colorize: true,
                              ignore: "pid,hostname",
                              translateTime: "HH:MM:ss.l",
                          },
                      },
                  }
                : false,
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
            message: "MQTT Subscriber Service is running",
            health: "/health",
        };
    });

    // Start server
    await server.listen({ port: configs.PORT, host: configs.HOST });
}

async function main() {
    // Connect to Kafka producer
    // TODO: Add reconncetion logic in to KafkaProducerService
    if (!(await KafkaProducer.connect())) {
        throw new Error(`Kafka producer is not connected!`);
    }

    // Initialize schema manager
    // TODO: Add reconncetion logic in here
    if (!(await SchemaManager.initialize())) {
        throw new Error(`Schema manager is not connected!`);
    }
    // Connect and start MQTT service
    MqttService.initialize();

    // Handle graceful shutdown
    const shutdown = async () => {
        logger.error("\n\nShutting down MQTT Subscriber Service...");
        // clearInterval(keepAlive);

        await MqttService.disconnect();

        await KafkaProducer.disconnect();

        logger.debug("Service shutdown complete");
        process.exit(0);
    };

    // Set up signal handlers
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}

await setupServer();
await main();
