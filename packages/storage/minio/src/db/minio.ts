import { Client } from "minio";
import { type MinioConfig } from "../config";

/** Runtime array of all bucket names available in the platform. */
const BUCKET_NAME_LIST = [
    "sensor-data",
    "historical-files",
    "user-uploads",
    "generated-reports",
    "pipeline-artifacts"
] as const;

/** Union type of all valid bucket name strings. */
type BUCKET_NAMES = (typeof BUCKET_NAME_LIST)[number];

let minioClient: Client | null = null;

/**
 * Initialise the MinIO client.
 * Must be called once at service startup before any operations.
 */
function initFileStorage(config: MinioConfig): void {
    if (minioClient) {
        return; // already initialised
    }
    minioClient = new Client({
        endPoint: config.host,
        port: config.port,
        useSSL: false,
        accessKey: config.user,
        secretKey: config.password
    });
}

function getMinioClient(): Client {
    if (!minioClient) {
        throw new Error("MinIO client not initialised. Call initDb() first.");
    }
    return minioClient;
}

export { initFileStorage, getMinioClient, BUCKET_NAME_LIST, type BUCKET_NAMES };
