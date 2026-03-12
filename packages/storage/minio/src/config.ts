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
// auth: user:password@host:port/dbName
const [auth, dbInfo] = inputVariable.split("@");
const [hostport, DATABASE_NAME] = dbInfo.split("/");
const [DATABASE_HOST, DATABASE_PORT] = hostport.split(":");
const [DATABASE_USER, DATABASE_PASSWORD] = auth.split(":");

export {
    NODE_ENV,
    DATABASE_HOST,
    DATABASE_PORT,
    DATABASE_USER,
    DATABASE_PASSWORD,
    DATABASE_NAME
};