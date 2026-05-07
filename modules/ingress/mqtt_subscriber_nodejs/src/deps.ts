// Core dependencies
import Fastify from "fastify";
import cors from "@fastify/cors";
import * as config from "./utils/config";

// Types
import type { FastifyPluginAsync, FastifyInstance } from "fastify";

// Initialize services
import { KafkaProducer, ServiceSchemaManager } from "@spine/messaging";
import { MQTTService } from "./services/MQTTService";

let kafkaConfig: config.KafkaConfig | undefined = undefined;
let kafkaTopic: string | undefined = undefined;
let schemaRegistryConfig: config.SchemaRegistryConfig | undefined = undefined;
let mqttConfig: config.MQTTConfig | undefined = undefined;

try {
    kafkaConfig = config.getKafkaConfig(config.CLIENT_ID);
    kafkaTopic = config.getKafkaTopic();
    schemaRegistryConfig = config.getSchemaRegistryConfig();
    mqttConfig = config.getMQTTConfig(config.CLIENT_ID);
} catch (error) {
    console.error("Error loading configuration:", error);
    process.exit(1);
}

const kafkaProducer = new KafkaProducer(kafkaConfig, kafkaTopic);
const schemaManager = new ServiceSchemaManager(schemaRegistryConfig);
const mqttService = new MQTTService(mqttConfig, schemaManager, kafkaProducer);

export { Fastify, cors };
export type { FastifyPluginAsync, FastifyInstance };
export { kafkaProducer, schemaManager, mqttService };
