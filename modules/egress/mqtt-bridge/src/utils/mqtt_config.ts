const clientId = process.env.CLIENT_ID;
if (!clientId) {
    throw new Error("CLIENT_ID is not set");
}

// MQTT configuration
interface MQTTConfig {
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

/**
 * Reads MQTT configuration from environment variables and returns an MQTTConfig object.
 *
 * Environment variables:
 * - MQTT_BROKER_URL: The URL of the MQTT broker (required)
 * - MQTT_QOS: The Quality of Service level (0, 1, or 2) (default: 0)
 * - MQTT_RETAIN: Whether to retain messages (true or false) (default: false)
 * - MQTT_KEEPALIVE: Keep-alive interval in seconds (default: 60)
 * - MQTT_RECONNECT_PERIOD: Reconnect period in milliseconds (default: 1000)
 * - MQTT_CONNECT_TIMEOUT: Connection timeout in milliseconds (default: 30000)
 * - MQTT_USERNAME: Username for MQTT authentication (optional)
 * - MQTT_PASSWORD: Password for MQTT authentication (optional)
 *
 * If MQTT_BROKER_URL is not set, an error is thrown.
 * The function caches the configuration after the first read to avoid redundant processing.
 *
 * @returns {MQTTConfig} The MQTT configuration object
 * @throws {Error} If MQTT_BROKER_URL is not set
 */
const getMQTTConfig = (): MQTTConfig => {
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
        throw new Error("MQTT_BROKER_URL is not set");
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
        brokerUrl: MQTT_BROKER_URL,
        clientId: `${clientId}-mqtt`,
        qos,
        retain,
        keepalive,
        reconnectPeriod,
        connectTimeout,
        username: MQTT_USERNAME,
        password: MQTT_PASSWORD
    };

    return mqttConfig;
};

export type { MQTTConfig };
export { getMQTTConfig };
