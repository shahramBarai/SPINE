// MQTT configuration
interface MQTTConfig {
    brokerUrl: string;
    clientId: string;
    topics: string[];
    qos: 0 | 1 | 2;
    clean: boolean;
    keepalive: number;
    reconnectPeriod: number;
    connectTimeout: number;
    username?: string;
    password?: string;
    will?: {
        topic: string;
        payload: string;
        qos: 0 | 1 | 2;
        retain: boolean;
    };
}

let mqttConfig: MQTTConfig | undefined = undefined;

const getMQTTConfig = (clientId: string): MQTTConfig => {
    if (mqttConfig) {
        return mqttConfig;
    }

    const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL;
    const MQTT_TOPICS = process.env.MQTT_TOPICS;
    const MQTT_QOS = process.env.MQTT_QOS;
    const MQTT_CLEAN = process.env.MQTT_CLEAN;
    const MQTT_KEEPALIVE = process.env.MQTT_KEEPALIVE;
    const MQTT_RECONNECT_PERIOD = process.env.MQTT_RECONNECT_PERIOD;
    const MQTT_CONNECT_TIMEOUT = process.env.MQTT_CONNECT_TIMEOUT;
    const MQTT_USERNAME = process.env.MQTT_USERNAME;
    const MQTT_PASSWORD = process.env.MQTT_PASSWORD;
    const MQTT_WILL_TOPIC = process.env.MQTT_WILL_TOPIC;
    const MQTT_WILL_PAYLOAD = process.env.MQTT_WILL_PAYLOAD;
    const MQTT_WILL_QOS = process.env.MQTT_WILL_QOS;
    const MQTT_WILL_RETAIN = process.env.MQTT_WILL_RETAIN;

    if (!MQTT_BROKER_URL || !MQTT_TOPICS) {
        throw new Error(
            `MQTT configuration is not set: 
                MQTT_BROKER_URL=${MQTT_BROKER_URL}, 
                MQTT_TOPICS=${MQTT_TOPICS}`
        );
    }

    const topics = MQTT_TOPICS.split(",").map((topic) => topic.trim());
    const qos = (MQTT_QOS ? parseInt(MQTT_QOS) : 0) as 0 | 1 | 2;
    const clean = MQTT_CLEAN !== "false"; // Default to true
    const keepalive = MQTT_KEEPALIVE ? parseInt(MQTT_KEEPALIVE) : 60;
    const reconnectPeriod = MQTT_RECONNECT_PERIOD
        ? parseInt(MQTT_RECONNECT_PERIOD)
        : 1000;
    const connectTimeout = MQTT_CONNECT_TIMEOUT
        ? parseInt(MQTT_CONNECT_TIMEOUT)
        : 30000;

    mqttConfig = {
        brokerUrl: MQTT_BROKER_URL,
        clientId: clientId,
        topics,
        qos,
        clean,
        keepalive,
        reconnectPeriod,
        connectTimeout,
        username: MQTT_USERNAME,
        password: MQTT_PASSWORD,
        will: MQTT_WILL_TOPIC
            ? {
                  topic: MQTT_WILL_TOPIC,
                  payload: MQTT_WILL_PAYLOAD || "",
                  qos: (MQTT_WILL_QOS ? parseInt(MQTT_WILL_QOS) : 0) as
                      | 0
                      | 1
                      | 2,
                  retain: MQTT_WILL_RETAIN === "true",
              }
            : undefined,
    };

    return mqttConfig;
};

export type { MQTTConfig };
export { getMQTTConfig };
