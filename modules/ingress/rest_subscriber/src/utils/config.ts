import dotenv from "dotenv";
dotenv.config();

const NODE_ENV: "prod" | "dev" = (process.env.NODE_ENV || "prod") as
    | "prod"
    | "dev";
const HOST = process.env.HOST || "0.0.0.0";
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// Options: kafka, excel, or console
// - kafka: Send data to Kafka topic
// - excel: Save data to Excel file
// - console: Log data to console
const SEND_TO = process.env.SEND_TO || "console";
if (SEND_TO !== "kafka" && SEND_TO !== "excel" && SEND_TO !== "console") {
    throw new Error(`SEND_TO must be one of: kafka, excel, console`);
}

type SupportedMethod = "GET" | "POST";
type AuthType = "none" | "basic" | "bearer" | "apikey" | "oauth2";
type ApiKeyLocation = "header" | "query";
type PaginationMode = "none" | "page" | "cursor" | "link";

interface RestAuthConfig {
    type: AuthType;
    username?: string;
    password?: string;
    bearerToken?: string;
    apiKey?: string;
    apiKeyHeader?: string;
    apiKeyQueryParam?: string;
    apiKeyLocation?: ApiKeyLocation;
    customHeaders?: Record<string, string>;
    oauth?: {
        tokenUrl: string;
        clientId: string;
        clientSecret: string;
        scope?: string;
        audience?: string;
        grantType: string;
        refreshMarginSeconds: number;
    };
}

interface RestEndpointConfig {
    path: string;
    method: SupportedMethod;
    bodyTemplate?: unknown;
}

interface RestPaginationConfig {
    mode: PaginationMode;
    pageParam?: string;
    pageSizeParam?: string;
    pageSize?: number;
    maxPages?: number;
    cursorParam?: string;
    nextCursorField?: string;
    nextLinkField?: string;
}

interface RestPollingConfig {
    pollIntervalMs: number;
    timeoutMs: number;
    retryAttempts: number;
    retryDelayMs: number;
}

interface RestApiConfig {
    baseUrl: string;
    endpoints: RestEndpointConfig[];
    poller: RestPollingConfig;
    auth: RestAuthConfig;
    pagination: RestPaginationConfig;
    customHeaders: Record<string, string>;
    defaultMethod: SupportedMethod;
}

const parseNumber = (
    value: string | undefined,
    fallback: number,
): number => {
    if (!value) {
        return fallback;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const parseJSON = (value: string | undefined) => {
    if (!value) {
        return undefined;
    }
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
};

const parseCustomHeaders = (rawHeaders: string | undefined) => {
    if (!rawHeaders) {
        return {};
    }
    return rawHeaders.split(/[,;]+/u).reduce<Record<string, string>>(
        (acc, entry) => {
            const separatorIndex = entry.search(/[:=]/u);
            const headerKey =
                separatorIndex === -1
                    ? entry.trim()
                    : entry.slice(0, separatorIndex).trim();
            const headerValue =
                separatorIndex === -1
                    ? ""
                    : entry.slice(separatorIndex + 1).trim();
            if (headerKey && headerValue) {
                acc[headerKey] = headerValue;
            }
            return acc;
        },
        {},
    );
};

const parseMethod = (value: string | undefined, fallback: SupportedMethod) => {
    if (!value) {
        return fallback;
    }
    return value.toUpperCase() === "POST" ? "POST" : "GET";
};

const parseEndpoints = (
    rawEndpoints: string,
    fallbackMethod: SupportedMethod,
): RestEndpointConfig[] => {
    return rawEndpoints
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => {
            const [path, method, body] = entry.split("|").map((part) => part.trim());
            if (!path) {
                throw new Error("REST_API_ENDPOINTS contains an empty path");
            }
            return {
                path,
                method: parseMethod(method, fallbackMethod),
                bodyTemplate: parseJSON(body),
            };
        });
};

// Empathic Building API configuration
import type { EmpathicBuildingConfig } from "@spine/ingress";

let empathicBuildingConfig: EmpathicBuildingConfig | undefined = undefined;

const getEmpathicBuildingConfig = (): EmpathicBuildingConfig => {
    if (empathicBuildingConfig) {
        return empathicBuildingConfig;
    }

    const EB_BASE_URL = process.env.EB_BASE_URL || "https://eu-api.empathicbuilding.com";
    const EB_PUSHER_KEY = process.env.EB_PUSHER_KEY || "33d6c4f799c274f7e0bc";
    const EB_PUSHER_CLUSTER = process.env.EB_PUSHER_CLUSTER || "eu";
    const EB_BEARER_TOKEN = process.env.EB_BEARER_TOKEN;
    const EB_USERNAME = process.env.EB_USERNAME;
    const EB_PASSWORD = process.env.EB_PASSWORD;
    const EB_ORGANIZATION_IDS = process.env.EB_ORGANIZATION_IDS;
    const EB_LOCATION_IDS = process.env.EB_LOCATION_IDS;
    const EB_SUBSCRIBE_NOTIFICATIONS = process.env.EB_SUBSCRIBE_NOTIFICATIONS === "true";
    const EB_RECONNECT_DELAY_MS = process.env.EB_RECONNECT_DELAY_MS;
    const EB_MAX_RECONNECT_ATTEMPTS = process.env.EB_MAX_RECONNECT_ATTEMPTS;

    // Validate authentication: either bearerToken or username/password
    if (!EB_BEARER_TOKEN && (!EB_USERNAME || !EB_PASSWORD)) {
        throw new Error(
            `Empathic Building configuration is not set: Either EB_BEARER_TOKEN or both EB_USERNAME and EB_PASSWORD must be provided`,
        );
    }

    if (!EB_ORGANIZATION_IDS && !EB_LOCATION_IDS && !EB_SUBSCRIBE_NOTIFICATIONS) {
        throw new Error(
            `Empathic Building configuration is not set: At least one of EB_ORGANIZATION_IDS, EB_LOCATION_IDS, or EB_SUBSCRIBE_NOTIFICATIONS must be configured`,
        );
    }

    empathicBuildingConfig = {
        baseUrl: EB_BASE_URL,
        pusherKey: EB_PUSHER_KEY,
        pusherCluster: EB_PUSHER_CLUSTER,
        bearerToken: EB_BEARER_TOKEN,
        username: EB_USERNAME,
        password: EB_PASSWORD,
        organizationIds: EB_ORGANIZATION_IDS
            ? EB_ORGANIZATION_IDS.split(",").map((id) => id.trim())
            : undefined,
        locationIds: EB_LOCATION_IDS
            ? EB_LOCATION_IDS.split(",").map((id) => id.trim())
            : undefined,
        subscribeToNotifications: EB_SUBSCRIBE_NOTIFICATIONS,
        reconnectDelayMs: parseNumber(EB_RECONNECT_DELAY_MS, 5000),
        maxReconnectAttempts: parseNumber(EB_MAX_RECONNECT_ATTEMPTS, 10),
    };

    return empathicBuildingConfig;
};

export {
    NODE_ENV,
    HOST,
    PORT,
    SEND_TO,
    getEmpathicBuildingConfig,
    type RestApiConfig,
    type RestEndpointConfig,
    type RestPaginationConfig,
    type RestPollingConfig,
    type RestAuthConfig,
};