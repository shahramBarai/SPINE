import { Client } from "minio";
import { logger } from "../utils/logger";

// Initialize MinIO client
export const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT || "localhost",
  port: parseInt(process.env.MINIO_PORT || "9000"),
  useSSL: process.env.MINIO_USE_SSL === "true",
  accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
  secretKey: process.env.MINIO_SECRET_KEY || "minioadmin",
});

// Test connection and log status
export const initMinioConnection = async () => {
  try {
    // Test connection by listing buckets
    await minioClient.listBuckets();
    logger.info("MinIO connection established successfully");
  } catch (error) {
    logger.error(error, "Failed to connect to MinIO");
    throw error;
  }
};

// Default bucket names for the platform
export const BUCKET_NAMES = {
  SENSOR_DATA: "sensor-data",
  HISTORICAL_FILES: "historical-files",
  USER_UPLOADS: "user-uploads",
  GENERATED_REPORTS: "generated-reports",
  PIPELINE_ARTIFACTS: "pipeline-artifacts",
} as const;
