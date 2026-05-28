import Fastify, {
    type FastifyPluginAsync,
    type FastifyInstance
} from "fastify";
import cors from "@fastify/cors";
import * as configs from "./utils/config";
import { logger } from "./utils/logger";

// Initialize services
import { KafkaProducer, ServiceSchemaManager } from "@spine/messaging";
import { EmpathicBuildingService } from "./services/EmpathicBuildingService";
import { EBPusherService } from "./services/EBPusherService";
import { getEmpathicBuildingConfig } from "./utils/config";
import { ExcelService } from "./services/ExcelService";

// Initialize services based on SEND_TO configuration
const excelService = configs.SEND_TO === "excel" ? new ExcelService() : null;
const kafkaProducer =
    configs.SEND_TO === "kafka"
        ? new KafkaProducer(
              configs.getKafkaConfig(),
              configs.getKafkaTopic(),
              logger
          )
        : null;
const schemaManager =
    configs.SEND_TO === "kafka"
        ? new ServiceSchemaManager(configs.getSchemaRegistryConfig())
        : null;
// Initialize Empathic Building services
const { api: ebApiConfig, pusher: ebPusherConfig } =
    getEmpathicBuildingConfig();
const ebAPIService = new EmpathicBuildingService(ebApiConfig);
const ebPusherService = new EBPusherService(ebPusherConfig);

// Export dependencies
export {
    Fastify,
    cors,
    configs,
    excelService,
    kafkaProducer,
    schemaManager,
    ebAPIService,
    ebPusherService
};

export type { FastifyPluginAsync, FastifyInstance };
