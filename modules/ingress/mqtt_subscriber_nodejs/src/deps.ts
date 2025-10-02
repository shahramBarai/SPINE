// Core dependencies
import Fastify from "fastify";
import cors from "@fastify/cors";

// Types
import { FastifyPluginAsync, FastifyInstance } from "fastify";

// Initialize services
import { KafkaProducerService } from "./services/KafkaProducerService";
import { ServiceSchemaManager } from "./services/SchemaRegistryService";
import { MQTTService } from "./services/MQTTService";

const KafkaProducer = new KafkaProducerService();
const SchemaManager = new ServiceSchemaManager();
const MqttService = new MQTTService(SchemaManager, KafkaProducer);

export { Fastify, cors };
export type { FastifyPluginAsync, FastifyInstance };
export { KafkaProducer, SchemaManager, MqttService };
