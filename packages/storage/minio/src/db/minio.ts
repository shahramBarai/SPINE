import { Client } from "minio";
import { DATABASE_HOST, DATABASE_PORT, DATABASE_USER, DATABASE_PASSWORD } from "../config";
import { logger } from "@spine/shared";

/** Runtime array of all bucket names available in the platform. */
const BUCKET_NAME_LIST = [
    "sensor-data",
    "historical-files",
    "user-uploads",
    "generated-reports",
    "pipeline-artifacts",
] as const;

/** Union type of all valid bucket name strings. */
type BUCKET_NAMES = (typeof BUCKET_NAME_LIST)[number];

// Initialize MinIO client
const minioClient = new Client({
    endPoint: DATABASE_HOST,
    port: parseInt(DATABASE_PORT),
    useSSL: false,
    accessKey: DATABASE_USER,
    secretKey: DATABASE_PASSWORD,
});

export {
    minioClient,
    BUCKET_NAME_LIST,
    type BUCKET_NAMES,
};
