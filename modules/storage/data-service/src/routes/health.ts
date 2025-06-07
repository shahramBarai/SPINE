import { FastifyPluginAsync, FastifyInstance } from "../deps";
import { platformDb } from "../db/platform";
import { timescaleDb } from "../db/timescale";
import { minioClient } from "../db/minio";

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  services: {
    platform: "connected" | "disconnected" | "unknown";
    timescale: "connected" | "disconnected" | "unknown";
    minio: "connected" | "disconnected" | "unknown";
  };
  details: {
    platform?: { latency?: number; error?: string };
    timescale?: { latency?: number; error?: string };
    minio?: { latency?: number; error?: string };
  };
}

export const healthRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance
) => {
  // Comprehensive health check
  fastify.get("/health", async (request, reply) => {
    const health: HealthStatus = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      services: {
        platform: "unknown",
        timescale: "unknown",
        minio: "unknown",
      },
      details: {},
    };

    let failureCount = 0;

    // Check PostgreSQL Platform DB
    try {
      const start = Date.now();
      await platformDb.$queryRaw`SELECT 1`;
      const latency = Date.now() - start;
      health.services.platform = "connected";
      health.details.platform = { latency };
    } catch (error: any) {
      health.services.platform = "disconnected";
      health.details.platform = { error: error.message };
      failureCount++;
    }

    // Check TimescaleDB
    try {
      const start = Date.now();
      await timescaleDb.$queryRaw`SELECT 1`;
      const latency = Date.now() - start;
      health.services.timescale = "connected";
      health.details.timescale = { latency };
    } catch (error: any) {
      health.services.timescale = "disconnected";
      health.details.timescale = { error: error.message };
      failureCount++;
    }

    // Check MinIO
    try {
      const start = Date.now();
      await minioClient.listBuckets();
      const latency = Date.now() - start;
      health.services.minio = "connected";
      health.details.minio = { latency };
    } catch (error: any) {
      health.services.minio = "disconnected";
      health.details.minio = { error: error.message };
      failureCount++;
    }

    // Determine overall health status
    if (failureCount === 0) {
      health.status = "healthy";
    } else if (failureCount < 3) {
      health.status = "degraded";
    } else {
      health.status = "unhealthy";
    }

    const statusCode = health.status === "healthy" ? 200 : 503;
    reply.code(statusCode).send(health);
  });

  // Individual service health checks
  fastify.get("/health/platform", async (request, reply) => {
    try {
      const start = Date.now();
      await platformDb.$queryRaw`SELECT 1`;
      const latency = Date.now() - start;
      reply.send({
        service: "platform",
        status: "connected",
        latency,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      reply.code(503).send({
        service: "platform",
        status: "disconnected",
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  fastify.get("/health/timescale", async (request, reply) => {
    try {
      const start = Date.now();
      await timescaleDb.$queryRaw`SELECT 1`;
      const latency = Date.now() - start;
      reply.send({
        service: "timescale",
        status: "connected",
        latency,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      reply.code(503).send({
        service: "timescale",
        status: "disconnected",
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  fastify.get("/health/minio", async (request, reply) => {
    try {
      const start = Date.now();
      await minioClient.listBuckets();
      const latency = Date.now() - start;
      reply.send({
        service: "minio",
        status: "connected",
        latency,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      reply.code(503).send({
        service: "minio",
        status: "disconnected",
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });
};
