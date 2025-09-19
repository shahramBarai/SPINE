import { Fastify, cors } from "./deps";
import { logger } from "./utils/logger";
// import { initMinioConnection } from "./db/minio";
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
// import { fileStorageRoutes, bucketRoutes } from "./routes/minio";

import "dotenv/config";

const server = Fastify({
  maxParamLength: 5000,
  logger:
    process.env.NODE_ENV === "development"
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
      : true,
});

// Register error handler
server.register(errorHandlerPlugin);

// Register CORS for cross-origin requests
server.register(cors, {
  origin: true,
});

// Register multipart support for file uploads
server.register(import("@fastify/multipart"), {
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
});

// // Initialize database connections
// initMinioConnection().then(() => {
//   logger.info("MinIO connection initialized");
// }).catch((error) => {
//   logger.warn("MinIO connection failed to initialize", error);
// });

// Register Health Routes
server.register(healthRoutes);

// Register Platform Database Routes (PostgreSQL)
server.register(userRoutes, { prefix: "/api/platform" });
server.register(projectRoutes, { prefix: "/api/platform" });
server.register(pipelineRoutes, { prefix: "/api/platform" });
server.register(kafkaTopicRoutes, { prefix: "/api/platform" });
server.register(schemaRoutes, { prefix: "/api/platform" });
server.register(connectorRoutes, { prefix: "/api/platform" });
server.register(validatorRoutes, { prefix: "/api/platform" });

// Register TimescaleDB Routes (Time-series data)
server.register(sensorDataRoutes, { prefix: "/api/timescale" });
server.register(timeseriesRoutes, { prefix: "/api/timescale" });

// // Register MinIO Routes (File storage)
// server.register(fileStorageRoutes, { prefix: "/api/storage" });
// server.register(bucketRoutes, { prefix: "/api/storage" });

// API info endpoint
server.get("/api", async () => {
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

// Root endpoint
server.get("/", async () => {
  return {
    message: "IoT Platform Data Service is running",
    documentation: "/api",
    health: "/health",
  };
});

const start = async () => {
  try {

    const PORT = process.env.PORT;
    const HOST = process.env.HOST;

    if (!PORT || !HOST) {
      throw new Error("PORT or HOST is not set in the environment variables. Please check the .env file.");
    }

    const port = parseInt(PORT, 10);
    const host = HOST;

    await server.listen({ port, host });

    server.log.info(`🚀 Data Service running on http://${host}:${port}`);
    server.log.info(`🏥 Health Check: http://${host}:${port}/health`);
    server.log.info(`📊 Platform API: http://${host}:${port}/api/platform`);
    server.log.info(
      `⏱️  TimescaleDB API: http://${host}:${port}/api/timescale`
    );
    server.log.info(`📁 Storage API: http://${host}:${port}/api/storage`);
    server.log.info(`📚 API Documentation: http://${host}:${port}/api`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
