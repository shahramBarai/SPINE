import { FastifyPluginAsync, FastifyInstance } from "../deps";
import { kafkaProducer, schemaManager } from "../deps";

interface HealthStatus {
    status: "healthy" | "degraded" | "unhealthy";
    timestamp: string;
    services: {
        mqtt: unknown;
        kafka: unknown;
        schema: unknown;
    };
}

const healthRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
    fastify.get("/health", async (request, reply) => {
        const health: HealthStatus = {
            status: "healthy",
            timestamp: new Date().toISOString(),
            services: {
                mqtt: null,
                kafka: null,
                schema: null,
            },
        };

        // Check Kafka connection
        health.services.kafka = kafkaProducer ? await kafkaProducer.healthCheck() : {
            status: "disabled",
            timestamp: new Date().toISOString(),
        };

        // Check Schema connection
        health.services.schema = schemaManager ? await schemaManager.healthCheck() : {
            status: "disabled",
            timestamp: new Date().toISOString(),
        };

        // TODO: Add REST connection health check
        
        const statusCode = health.status === "healthy" ? 200 : 503;
        reply.code(statusCode).send(health);
    });
};

export { healthRoutes };
