import Fastify, {
    type FastifyPluginAsync,
    type FastifyInstance,
} from "fastify";
import cors from "@fastify/cors";
import * as configs from "./utils/config";

// Initialize services
import { KafkaProducer, ServiceSchemaManager } from "@spine/messaging";
import { EmpathicBuildingService } from "./services/EmpathicBuildingService";
import { getEmpathicBuildingConfig } from "./utils/config";
import { ExcelService } from "./services/ExcelService";

// Initialize services based on SEND_TO configuration
const excelService = configs.SEND_TO === "excel" ? new ExcelService() : null;
const kafkaProducer =
    configs.SEND_TO === "kafka"
        ? new KafkaProducer(configs.getKafkaConfig(), configs.getKafkaTopic())
        : null;
const schemaManager =
    configs.SEND_TO === "kafka"
        ? new ServiceSchemaManager(configs.getSchemaRegistryConfig())
        : null;
// Initialize Empathic Building service
const empathicBuildingService = new EmpathicBuildingService(
    getEmpathicBuildingConfig()
);

// Export dependencies
export {
    Fastify,
    cors,
    configs,
    excelService,
    kafkaProducer,
    schemaManager,
    empathicBuildingService,
};

export type { FastifyPluginAsync, FastifyInstance };
