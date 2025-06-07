import { Fastify, fastifyCors } from "./deps";
import { logger } from "./utils/logger";
import { initMinioConnection } from "./db/minio";
import { errorHandlerPlugin } from "./utils/errors";
import { healthRoutes } from "./routes/health";

// Platform Database Routes
import {
  userRoutes,
  projectRoutes,
  pipelineRoutes,
  kafkaTopicRoutes,
  schemaRoutes,
  connectorRoutes,
  validatorRoutes,
} from "./routes/platform";

// TimescaleDB Routes
import { sensorDataRoutes, timeseriesRoutes } from "./routes/timescale";

// MinIO Routes
import { fileStorageRoutes, bucketRoutes } from "./routes/minio";

import "dotenv/config";

const startServer = async () => {
  try {
    const app = Fastify({
      logger,
    });

    // Register error handling plugin first
    await app.register(errorHandlerPlugin);

    // Register plugins
    await app.register(fastifyCors, {
      origin: true,
    });

    // Register multipart support for file uploads
    await app.register(import("@fastify/multipart"), {
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB
      },
    });

    // Initialize database connections
    try {
      await initMinioConnection();
      logger.info("Database connections initialized");
    } catch (error) {
      logger.warn("Some database connections failed to initialize", error);
    }

    // Register Health Routes
    await app.register(healthRoutes);

    // Register Platform Database Routes (PostgreSQL)
    await app.register(userRoutes, { prefix: "/api/platform" });
    await app.register(projectRoutes, { prefix: "/api/platform" });
    await app.register(pipelineRoutes, { prefix: "/api/platform" });
    await app.register(kafkaTopicRoutes, { prefix: "/api/platform" });
    await app.register(schemaRoutes, { prefix: "/api/platform" });
    await app.register(connectorRoutes, { prefix: "/api/platform" });
    await app.register(validatorRoutes, { prefix: "/api/platform" });

    // Register TimescaleDB Routes (Time-series data)
    await app.register(sensorDataRoutes, { prefix: "/api/timescale" });
    await app.register(timeseriesRoutes, { prefix: "/api/timescale" });

    // Register MinIO Routes (File storage)
    await app.register(fileStorageRoutes, { prefix: "/api/storage" });
    await app.register(bucketRoutes, { prefix: "/api/storage" });

    // API info route
    app.get("/api", async () => {
      return {
        name: "IoT Platform Data Service",
        version: "1.0.0",
        description: "Multi-database data service for IoT platform",
        documentation: {
          health: "/health - Service health checks",
          platform: "/api/platform - PostgreSQL platform data",
          timescale: "/api/timescale - TimescaleDB sensor data",
          storage: "/api/storage - MinIO file storage",
        },
        timestamp: new Date().toISOString(),
      };
    });

    // Start server
    const port = parseInt(process.env.PORT || "3010", 10);
    const host = process.env.HOST || "0.0.0.0";

    await app.listen({ port, host });
    logger.info(`🚀 Data Service running on http://${host}:${port}`);
    logger.info(`🏥 Health Check: http://${host}:${port}/health`);
    logger.info(`📊 Platform API: http://${host}:${port}/api/platform`);
    logger.info(`⏱️  TimescaleDB API: http://${host}:${port}/api/timescale`);
    logger.info(`📁 Storage API: http://${host}:${port}/api/storage`);
  } catch (err) {
    logger.error(err, "Error starting server");
    process.exit(1);
  }
};

startServer();
