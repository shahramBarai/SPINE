import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SHARED_ENV_FILE = resolve(dirname(fileURLToPath(import.meta.url)), "../.env");

interface WorkspaceEnv {
    NODE_ENV: string;
    LOG_LEVEL: string;
    MQTT_USERNAME: string;
    MQTT_PASSWORD: string;
    DATABASE_URL_PLATFORM: string;
    DATABASE_URL_TIMESCALE: string;
    DATABASE_URL_MINIO: string;
    KAFKA_BROKERS: string;
    SCHEMA_REGISTRY_URL: string;
    SCHEMA_REGISTRY_USERNAME?: string;
    SCHEMA_REGISTRY_PASSWORD?: string;
}

function requiredEnv(name: keyof WorkspaceEnv): string {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(`Missing required environment variable: ${String(name)}`);
    }

    return value;
}

// The shared package owns the single canonical workspace env file.
if (!existsSync(SHARED_ENV_FILE)) {
    throw new Error(`Missing workspace env file: ${SHARED_ENV_FILE}`);
}

// Load the env file once, then validate the values in one place.
dotenv.config({ path: SHARED_ENV_FILE });

const env: WorkspaceEnv = {
    NODE_ENV: requiredEnv("NODE_ENV"),
    LOG_LEVEL: requiredEnv("LOG_LEVEL"),
    MQTT_USERNAME: requiredEnv("MQTT_USERNAME"),
    MQTT_PASSWORD: requiredEnv("MQTT_PASSWORD"),
    DATABASE_URL_PLATFORM: requiredEnv("DATABASE_URL_PLATFORM"),
    DATABASE_URL_TIMESCALE: requiredEnv("DATABASE_URL_TIMESCALE"),
    DATABASE_URL_MINIO: requiredEnv("DATABASE_URL_MINIO"),
    KAFKA_BROKERS: requiredEnv("KAFKA_BROKERS"),
    SCHEMA_REGISTRY_URL: requiredEnv("SCHEMA_REGISTRY_URL"),
    SCHEMA_REGISTRY_USERNAME: process.env.SCHEMA_REGISTRY_USERNAME?.trim() || undefined,
    SCHEMA_REGISTRY_PASSWORD: process.env.SCHEMA_REGISTRY_PASSWORD?.trim() || undefined,
};

export type { WorkspaceEnv };
export { env };
