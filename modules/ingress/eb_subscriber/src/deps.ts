import Fastify, {
    type FastifyPluginAsync,
    type FastifyInstance
} from "fastify";
import cors from "@fastify/cors";
import * as configs from "./utils/config";

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
        ? new KafkaProducer(configs.getKafkaConfig(), configs.getKafkaTopic())
        : null;
const schemaManager =
    configs.SEND_TO === "kafka"
        ? new ServiceSchemaManager(configs.getSchemaRegistryConfig())
        : null;
// Initialize Empathic Building services
const { api: ebApiConfig, pusher: ebPusherConfig } =
    getEmpathicBuildingConfig();
const ebAPIService = new EmpathicBuildingService(ebApiConfig);

// Auth provider adapter for pusher service
const ebAuthProvider = {
    getToken: async (): Promise<string> => {
        // Ensure we have a valid token (authenticate will refresh if needed)
        await ebAPIService.authenticate();
        const token = ebAPIService.getAccessToken();
        if (!token) throw new Error("Failed to obtain EB access token");
        return token;
    }
};

const ebPusherService = new EBPusherService(ebPusherConfig, ebAuthProvider);

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
