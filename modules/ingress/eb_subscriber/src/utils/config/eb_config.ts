const parseNumber = (value: string | undefined, fallback: number): number => {
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

// Empathic Building API configuration
import type { EBApiConfig, EBPusherConfig } from "../eb_types";

let ebApiConfig: EBApiConfig | undefined = undefined;
let ebPusherConfig: EBPusherConfig | undefined = undefined;

const getEmpathicBuildingConfig = (): {
    api: EBApiConfig;
    pusher: EBPusherConfig;
} => {
    if (ebApiConfig && ebPusherConfig) {
        return { api: ebApiConfig, pusher: ebPusherConfig };
    }

    // Required configurations with no defaults
    const EB_USERNAME = process.env.EB_USERNAME;
    const EB_PASSWORD = process.env.EB_PASSWORD;
    const EB_ORGANIZATION_IDS = process.env.EB_ORGANIZATION_IDS;
    const EB_LOCATION_IDS = process.env.EB_LOCATION_IDS;

    // Validate authentication: either bearerToken or username/password
    if (!EB_USERNAME || !EB_PASSWORD) {
        throw new Error(
            `Empathic Building configuration is not set: Either EB_BEARER_TOKEN or both EB_USERNAME and EB_PASSWORD must be provided`
        );
    }

    if (!EB_ORGANIZATION_IDS && !EB_LOCATION_IDS) {
        throw new Error(
            `Empathic Building configuration is not set: At least one of EB_ORGANIZATION_IDS, EB_LOCATION_IDS, or EB_SUBSCRIBE_NOTIFICATIONS must be configured`
        );
    }

    // Optional configurations with defaults
    const EB_BASE_URL =
        process.env.EB_BASE_URL || "https://eu-api.empathicbuilding.com";
    const EB_PUSHER_KEY = process.env.EB_PUSHER_KEY || "33d6c4f799c274f7e0bc";
    const EB_PUSHER_CLUSTER = process.env.EB_PUSHER_CLUSTER || "eu";
    const EB_RECONNECT_DELAY_MS = process.env.EB_RECONNECT_DELAY_MS;
    const EB_MAX_RECONNECT_ATTEMPTS = process.env.EB_MAX_RECONNECT_ATTEMPTS;

    ebApiConfig = {
        baseUrl: EB_BASE_URL,
        username: EB_USERNAME,
        password: EB_PASSWORD
    };

    ebPusherConfig = {
        baseUrl: EB_BASE_URL,
        pusherKey: EB_PUSHER_KEY,
        pusherCluster: EB_PUSHER_CLUSTER,
        organizationIds: EB_ORGANIZATION_IDS
            ? EB_ORGANIZATION_IDS.split(",").map((id) => id.trim())
            : [],
        locationIds: EB_LOCATION_IDS
            ? EB_LOCATION_IDS.split(",").map((id) => id.trim())
            : [],
        reconnectDelayMs: parseNumber(EB_RECONNECT_DELAY_MS, 5000),
        maxReconnectAttempts: parseNumber(EB_MAX_RECONNECT_ATTEMPTS, 10)
    };

    return { api: ebApiConfig, pusher: ebPusherConfig };
};

let locationToCampusMap: Map<string, string> | undefined = undefined;

/**
 * External EB locationId -> internal campusId mapping.
 * JSON in env EB_LOCATION_TO_CAMPUS_MAP, e.g. {"7":"campus-1","8":"campus-2"}.
 * O(1) lookup via Map; missing key yields "unknown".
 */
const getLocationToCampusMap = (): Map<string, string> => {
    if (locationToCampusMap) {
        return locationToCampusMap;
    }

    const raw = process.env.EB_LOCATION_TO_CAMPUS_MAP;
    if (raw && typeof raw === "string") {
        try {
            const obj = parseJSON(raw) as Record<string, string> | undefined;
            if (!obj || typeof obj !== "object") {
                locationToCampusMap = new Map();
                return locationToCampusMap;
            }
            locationToCampusMap = new Map(
                Object.entries(obj).filter(([, v]) => typeof v === "string")
            );
            return locationToCampusMap;
        } catch {
            locationToCampusMap = new Map();
            return locationToCampusMap;
        }
    }
    locationToCampusMap = new Map();
    return locationToCampusMap;
};

export { getEmpathicBuildingConfig, getLocationToCampusMap };
