import dotenv from "dotenv";
dotenv.config();

const clientId = process.env.CLIENT_ID;
if (!clientId) {
    throw new Error("CLIENT_ID is not set");
}
const NODE_ENV: "prod" | "dev" = (process.env.NODE_ENV || "prod") as
    | "prod"
    | "dev";
const LOG_LEVEL: "error" | "warn" | "info" | "debug" = (process.env.LOG_LEVEL ||
    "warn") as "error" | "warn" | "info" | "debug";
const HOST = process.env.HOST || "0.0.0.0";
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// Kafka configuration
interface KafkaConfig {
    clientId: string;
    brokers: string[];
    connectionTimeout: number;
    requestTimeout: number;
    retry: {
        retries: number;
    };
}
let kafkaConfig: KafkaConfig | undefined = undefined;
let kafkaTopic: string | undefined = undefined;

const getKafkaConfig = (): KafkaConfig => {
    if (kafkaConfig) {
        return kafkaConfig;
    }
    const KAFKA_BROKERS = process.env.KAFKA_BROKERS;
    const KAFKA_CONNECTION_TIMEOUT = process.env.KAFKA_CONNECTION_TIMEOUT;
    const KAFKA_REQUEST_TIMEOUT = process.env.KAFKA_REQUEST_TIMEOUT;
    const KAFKA_RETRY_RETRIES = process.env.KAFKA_RETRY_RETRIES;

    if (
        !KAFKA_BROKERS ||
        !KAFKA_CONNECTION_TIMEOUT ||
        !KAFKA_REQUEST_TIMEOUT ||
        !KAFKA_RETRY_RETRIES
    ) {
        throw new Error(
            `Kafka configuration is not set: 
                KAFKA_BROKERS=${KAFKA_BROKERS}, 
                KAFKA_CONNECTION_TIMEOUT=${KAFKA_CONNECTION_TIMEOUT}, 
                KAFKA_REQUEST_TIMEOUT=${KAFKA_REQUEST_TIMEOUT}, 
                KAFKA_RETRY_RETRIES=${KAFKA_RETRY_RETRIES}`,
        );
    }
    kafkaConfig = {
        clientId: clientId,
        brokers: KAFKA_BROKERS.split(","),
        connectionTimeout: parseInt(KAFKA_CONNECTION_TIMEOUT),
        requestTimeout: parseInt(KAFKA_REQUEST_TIMEOUT),
        retry: {
            retries: parseInt(KAFKA_RETRY_RETRIES),
        },
    };
    return kafkaConfig;
};
const getKafkaTopic = (): string => {
    if (kafkaTopic) {
        return kafkaTopic;
    }
    kafkaTopic = process.env.KAFKA_TOPIC_SENSOR_DATA;
    if (!kafkaTopic) {
        throw new Error("Kafka topic is not set");
    }
    return kafkaTopic;
};

// Schema Registry configuration
interface SchemaRegistryConfig {
    url: string;
    auth?: {
        username: string;
        password: string;
    };
    inputSubject: string;
    outputSubject: string;
    inputSchemaId?: string;
    outputSchemaId?: string;
    validateEnabled: boolean;
}
let schemaRegistryConfig: SchemaRegistryConfig | undefined = undefined;
const getSchemaRegistryConfig = (): SchemaRegistryConfig => {
    if (schemaRegistryConfig) {
        return schemaRegistryConfig;
    }
    const SCHEMA_REGISTRY_URL = process.env.SCHEMA_REGISTRY_URL;
    const SCHEMA_REGISTRY_USERNAME = process.env.SCHEMA_REGISTRY_USERNAME;
    const SCHEMA_REGISTRY_PASSWORD = process.env.SCHEMA_REGISTRY_PASSWORD;
    const SCHEMA_VALIDATION_ENABLED = process.env.SCHEMA_VALIDATION_ENABLED;
    const SERVICE_INPUT_SUBJECT = process.env.SERVICE_INPUT_SUBJECT;
    const SERVICE_OUTPUT_SUBJECT = process.env.SERVICE_OUTPUT_SUBJECT;
    const SERVICE_INPUT_SCHEMA_ID = process.env.SERVICE_INPUT_SCHEMA_ID;
    const SERVICE_OUTPUT_SCHEMA_ID = process.env.SERVICE_OUTPUT_SCHEMA_ID;

    if (
        !SCHEMA_REGISTRY_URL ||
        !SCHEMA_VALIDATION_ENABLED ||
        !SERVICE_INPUT_SUBJECT ||
        !SERVICE_OUTPUT_SUBJECT
    ) {
        throw new Error(
            `Schema Registry configuration is not set: 
                SCHEMA_REGISTRY_URL=${SCHEMA_REGISTRY_URL}, 
                SCHEMA_VALIDATION_ENABLED=${SCHEMA_VALIDATION_ENABLED}, 
                SERVICE_INPUT_SUBJECT=${SERVICE_INPUT_SUBJECT}, 
                SERVICE_OUTPUT_SUBJECT=${SERVICE_OUTPUT_SUBJECT}`,
        );
    }
    schemaRegistryConfig = {
        url: SCHEMA_REGISTRY_URL,
        auth:
            SCHEMA_REGISTRY_USERNAME && SCHEMA_REGISTRY_PASSWORD
                ? {
                      username: SCHEMA_REGISTRY_USERNAME,
                      password: SCHEMA_REGISTRY_PASSWORD,
                  }
                : undefined,
        inputSubject: SERVICE_INPUT_SUBJECT,
        outputSubject: SERVICE_OUTPUT_SUBJECT,
        inputSchemaId: SERVICE_INPUT_SCHEMA_ID,
        outputSchemaId: SERVICE_OUTPUT_SCHEMA_ID,
        validateEnabled: SCHEMA_VALIDATION_ENABLED === "true",
    };
    return schemaRegistryConfig;
};

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

const getMQTTConfig = (): MQTTConfig => {
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
                MQTT_TOPICS=${MQTT_TOPICS}`,
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

export {
    NODE_ENV,
    LOG_LEVEL,
    HOST,
    PORT,
    getKafkaConfig,
    getKafkaTopic,
    getSchemaRegistryConfig,
    getMQTTConfig,
    type SchemaRegistryConfig,
    type MQTTConfig,
};
