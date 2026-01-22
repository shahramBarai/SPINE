import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import * as configs from "./utils/config";

// Initialize services
import { KafkaProducer, ServiceSchemaManager } from "@spine/messaging";
import { EmpathicBuildingService } from "@spine/ingress";
import { getEmpathicBuildingConfig } from "./utils/config";
import { ExcelService } from "./services/ExcelService";

// Initialize services based on SEND_TO configuration
const excelService = configs.SEND_TO === "excel" ? new ExcelService() : null;
const kafkaProducer = configs.SEND_TO === "kafka" ? new KafkaProducer() : null;
const schemaManager = configs.SEND_TO === "kafka" ? new ServiceSchemaManager() : null;
// Initialize Empathic Building service
const empathicBuildingService = new EmpathicBuildingService(getEmpathicBuildingConfig());

// Export dependencies
export {
    Fastify,
    cors,
    z,
    configs,
    excelService,
    kafkaProducer,
    schemaManager,
    empathicBuildingService,
  };