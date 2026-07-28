import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SHARED_ENV_FILE = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../.env"
);

interface WorkspaceEnv {
    NODE_ENV: string;
    LOG_LEVEL: string;
    DATABASE_URL_PLATFORM: string;
    DATABASE_URL_TIMESCALE: string;
    DATABASE_URL_MINIO: string;
    DATABASE_URL_FUSEKI: string;
    KAFKA_BROKERS: string;
    SCHEMA_REGISTRY_URL: string;
    SCHEMA_REGISTRY_USERNAME?: string;
    SCHEMA_REGISTRY_PASSWORD?: string;
    FRONTEND_URL: string;
    BACKEND_URL: string;
    SECRET_COOKIE_PASSWORD: string;
    BUILDING_SERVICE_URL: string;
    IFC_LITE_SERVER_URL: string;
}

function requiredEnv(name: keyof WorkspaceEnv): string {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(
            `Missing required environment variable: ${String(name)}`
        );
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
    DATABASE_URL_PLATFORM: requiredEnv("DATABASE_URL_PLATFORM"),
    DATABASE_URL_TIMESCALE: requiredEnv("DATABASE_URL_TIMESCALE"),
    DATABASE_URL_MINIO: requiredEnv("DATABASE_URL_MINIO"),
    DATABASE_URL_FUSEKI: requiredEnv("DATABASE_URL_FUSEKI"),
    KAFKA_BROKERS: requiredEnv("KAFKA_BROKERS"),
    SCHEMA_REGISTRY_URL: requiredEnv("SCHEMA_REGISTRY_URL"),
    SCHEMA_REGISTRY_USERNAME:
        process.env.SCHEMA_REGISTRY_USERNAME?.trim() || undefined,
    SCHEMA_REGISTRY_PASSWORD:
        process.env.SCHEMA_REGISTRY_PASSWORD?.trim() || undefined,
    FRONTEND_URL: requiredEnv("FRONTEND_URL"),
    BACKEND_URL: requiredEnv("BACKEND_URL"),
    SECRET_COOKIE_PASSWORD: requiredEnv("SECRET_COOKIE_PASSWORD"),
    // Not required (unlike the others above): building-service is optional,
    // experimental infra, not part of the core docker-compose stack, so a
    // missing .env entry shouldn't crash every other package that imports
    // this shared env - it just falls back to the local dev default.
    BUILDING_SERVICE_URL:
        process.env.BUILDING_SERVICE_URL?.trim() ||
        "http://172.29.248.145:8000",
    // Not required, same reasoning as BUILDING_SERVICE_URL: the ifc-lite-server
    // container (see modules/modeling/docker-compose.yml) is optional
    // server-assisted IFC parsing infra - the viewer falls back to parsing
    // client-side when it's unset or unreachable.
    IFC_LITE_SERVER_URL:
        process.env.IFC_LITE_SERVER_URL?.trim() || "http://localhost:3001"
};

export type { WorkspaceEnv };
export { env };
