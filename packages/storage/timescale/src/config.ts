import dotenv from "dotenv";
import { logger } from "@spine/shared";

dotenv.config({ path: ["../../../../.env", ".env"] });

let inputVariable: string | undefined;
let NODE_ENV: string;
let DATABASE_URL: string;

// Node environment
inputVariable = process.env.NODE_ENV;
if (!inputVariable) {
  logger.warn("NODE_ENV is not set in the environment variables. Defaulting to 'prod'.");
  inputVariable = "prod";
}
NODE_ENV = inputVariable;

// Database URL
inputVariable = process.env.DATABASE_URL_TIMESCALE;
if (!inputVariable) {
  throw new Error("DATABASE_URL_TIMESCALE is not set in the environment variables. Please check the .env file.");
}
DATABASE_URL = inputVariable;

export { DATABASE_URL, NODE_ENV };