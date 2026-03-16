import dotenv from "dotenv";
import { logger } from "@spine/shared";

dotenv.config({ path: ["../../../../.env", ".env"] });

let inputVariable: string | undefined;

// Node environment
inputVariable = process.env.NODE_ENV;
if (!inputVariable) {
    logger.warn("NODE_ENV is not set in the environment variables. Defaulting to 'prod'.");
    inputVariable = "prod";
}
const NODE_ENV = inputVariable;

// Database URL
inputVariable = process.env.DATABASE_URL_MINIO;
if (!inputVariable) {
    throw new Error("DATABASE_URL_MINIO is not set in the environment variables. Please check the .env file.");
}
let parsedUrl: URL;
try {
    // Treat as http:// if no protocol provided so URL parsing works
    const urlString = inputVariable.includes("://") ? inputVariable : `http://${inputVariable}`;
    parsedUrl = new URL(urlString);
} catch (error) {
    throw new Error(`Invalid DATABASE_URL_MINIO format: ${inputVariable}`);
}

const DATABASE_USER = decodeURIComponent(parsedUrl.username);
const DATABASE_PASSWORD = decodeURIComponent(parsedUrl.password);
const DATABASE_HOST = parsedUrl.hostname;
const DATABASE_PORT = parsedUrl.port;
const DATABASE_NAME = parsedUrl.pathname.replace(/^\//, "");

if (!DATABASE_USER || !DATABASE_PASSWORD || !DATABASE_HOST) {
    throw new Error("DATABASE_URL_MINIO is missing required components (user, password, or host).");
}

export {
    NODE_ENV,
    DATABASE_HOST,
    DATABASE_PORT,
    DATABASE_USER,
    DATABASE_PASSWORD,
    DATABASE_NAME
};