import { FastifyPluginAsync, FastifyInstance } from "../deps";
import { KafkaProducer, SchemaManager, MqttService } from "../deps";

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
        health.services.kafka = await KafkaProducer.healthCheck();

        // Check Schema connection
        health.services.schema = await SchemaManager.healthCheck();

        // Check MQTT connection
        const mqttHealthStatus = await MqttService.healthCheck();
        health.services.mqtt = mqttHealthStatus;

        if (mqttHealthStatus.connectionState.isConnecting) {
            health.status = "degraded";
        }

        if (mqttHealthStatus.connectionState.reconnectAttempts > 10) {
            health.status = "unhealthy";
        }

        const statusCode = health.status === "healthy" ? 200 : 503;
        reply.code(statusCode).send(health);
    });
};

export { healthRoutes };
