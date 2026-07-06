import { Client } from "minio";
import { env } from "@spine/shared";

// DATABASE_URL_MINIO="username:password@host:port/databasename"
const ErrorMessages =
    "Invalid DATABASE_URL_MINIO format. Expected format: username:password@host:port/databasename";

const [credentials, db] = env.DATABASE_URL_MINIO.split("@");

if (!credentials || !db) {
    throw new Error(ErrorMessages);
}
const [hostPort, dbName] = db.split("/");
if (!hostPort || !dbName) {
    throw new Error(ErrorMessages);
}
const [user, password] = credentials.split(":");
const [host, port] = hostPort.split(":");

if (!user || !password || !host || !port) {
    throw new Error(ErrorMessages);
}

/** Runtime array of all bucket names available in the platform. */
const BUCKET_NAME_LIST = [
    "sensor-data",
    "historical-files",
    "user-uploads",
    "generated-reports",
    "pipeline-artifacts",
    "project-files"
] as const;

/** Union type of all valid bucket name strings. */
type BUCKET_NAMES = (typeof BUCKET_NAME_LIST)[number];

const minioClient: Client = new Client({
    endPoint: host,
    port: parseInt(port),
    useSSL: false,
    accessKey: user,
    secretKey: password
});

export { minioClient, BUCKET_NAME_LIST, type BUCKET_NAMES };
