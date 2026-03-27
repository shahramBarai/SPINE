import dotenv from "dotenv";
dotenv.config();

const clientId = process.env.CLIENT_ID;
if (!clientId) {
    throw new Error("CLIENT_ID is not set");
}

const NODE_ENV: "prod" | "dev" = (process.env.NODE_ENV || "prod") as
    | "prod"
    | "dev";

const HOST = process.env.HOST || "0.0.0.0";
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// MQTT configuration
interface MQTTConfig {
    enabled: boolean;
    brokerUrl: string;
    clientId: string;
    qos: 0 | 1 | 2;
    retain: boolean;
    keepalive: number;
    reconnectPeriod: number;
    connectTimeout: number;
    username?: string;
    password?: string;
}

let mqttConfig: MQTTConfig | undefined = undefined;

const getMQTTConfig = (): MQTTConfig | null => {
    const MQTT_ENABLED = process.env.MQTT_ENABLED;
    
    // If MQTT is explicitly disabled, return null
    if (MQTT_ENABLED === "false") {
        return null;
    }

    if (mqttConfig) {
        return mqttConfig;
    }

    const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL;
    const MQTT_QOS = process.env.MQTT_QOS;
    const MQTT_RETAIN = process.env.MQTT_RETAIN;
    const MQTT_KEEPALIVE = process.env.MQTT_KEEPALIVE;
    const MQTT_RECONNECT_PERIOD = process.env.MQTT_RECONNECT_PERIOD;
    const MQTT_CONNECT_TIMEOUT = process.env.MQTT_CONNECT_TIMEOUT;
    const MQTT_USERNAME = process.env.MQTT_USERNAME;
    const MQTT_PASSWORD = process.env.MQTT_PASSWORD;

    // If no broker URL is provided, MQTT is disabled
    if (!MQTT_BROKER_URL) {
        return null;
    }

    const qos = (MQTT_QOS ? parseInt(MQTT_QOS) : 0) as 0 | 1 | 2;
    const retain = MQTT_RETAIN === "true";
    const keepalive = MQTT_KEEPALIVE ? parseInt(MQTT_KEEPALIVE) : 60;
    const reconnectPeriod = MQTT_RECONNECT_PERIOD
        ? parseInt(MQTT_RECONNECT_PERIOD)
        : 1000;
    const connectTimeout = MQTT_CONNECT_TIMEOUT
        ? parseInt(MQTT_CONNECT_TIMEOUT)
        : 30000;

    mqttConfig = {
        enabled: true,
        brokerUrl: MQTT_BROKER_URL,
        clientId: `${clientId}-mqtt`,
        qos,
        retain,
        keepalive,
        reconnectPeriod,
        connectTimeout,
        username: MQTT_USERNAME,
        password: MQTT_PASSWORD,
    };

    return mqttConfig;
};

// Helper to check if MQTT is enabled
const isMQTTEnabled = (): boolean => {
    return getMQTTConfig() !== null;
};

export {
    NODE_ENV,
    HOST,
    PORT,
    getMQTTConfig,
    type MQTTConfig,
    isMQTTEnabled,
};

