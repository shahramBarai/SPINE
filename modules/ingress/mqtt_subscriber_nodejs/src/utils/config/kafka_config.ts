import type { KafkaConfig, SchemaRegistryConfig } from "@spine/messaging";

// Kafka configuration
let kafkaConfig: KafkaConfig | undefined = undefined;
let kafkaTopic: string | undefined = undefined;

/**
 * Reads Kafka configuration from environment variables and returns a KafkaConfig object.
 *
 * Environment variables:
 * - KAFKA_BROKERS: Comma-separated list of Kafka broker addresses (required)
 * - KAFKA_CONNECTION_TIMEOUT: Connection timeout in milliseconds (default: 10000)
 * - KAFKA_REQUEST_TIMEOUT: Request timeout in milliseconds (default: 30000)
 * - KAFKA_RETRY_RETRIES: Number of retry attempts for failed requests (default: 5)
 * - CLIENT_ID: Client ID for Kafka producer/consumer (default: "eb_subscriber")
 *
 * If KAFKA_BROKERS is not set, an error is thrown.
 * The function caches the configuration after the first read to avoid redundant processing.
 *
 * @returns {KafkaConfig} The Kafka configuration object
 * @throws {Error} If KAFKA_BROKERS is not set
 */
const getKafkaConfig = (clientId: string): KafkaConfig => {
    if (kafkaConfig) return kafkaConfig;
    const KAFKA_BROKERS = process.env.KAFKA_BROKERS;
    if (!KAFKA_BROKERS) {
        throw new Error(
            `Kafka configuration is not set: KAFKA_BROKERS=${KAFKA_BROKERS}`
        );
    }

    const KAFKA_CONNECTION_TIMEOUT: number = parseInt(
        process.env.KAFKA_CONNECTION_TIMEOUT || "10000"
    );
    const KAFKA_REQUEST_TIMEOUT: number = parseInt(
        process.env.KAFKA_REQUEST_TIMEOUT || "30000"
    );
    const KAFKA_RETRY_RETRIES: number = parseInt(
        process.env.KAFKA_RETRY_RETRIES || "5"
    );

    kafkaConfig = {
        clientId: clientId,
        brokers: KAFKA_BROKERS.split(","),
        connectionTimeout: KAFKA_CONNECTION_TIMEOUT,
        requestTimeout: KAFKA_REQUEST_TIMEOUT,
        retry: { retries: KAFKA_RETRY_RETRIES }
    };

    return kafkaConfig;
};

/**
 * Reads Kafka topic from environment variable and returns it as a string.
 *
 * Environment variable:
 * - KAFKA_TOPIC_SENSOR_DATA: The Kafka topic to subscribe to for sensor data (required)
 *
 * If KAFKA_TOPIC_SENSOR_DATA is not set, an error is thrown.
 * The function caches the topic after the first read to avoid redundant processing.
 *
 * @returns {string} The Kafka topic
 * @throws {Error} If KAFKA_TOPIC_SENSOR_DATA is not set
 */
const getKafkaTopic = (): string => {
    if (kafkaTopic) return kafkaTopic;
    kafkaTopic = process.env.KAFKA_TOPIC_SENSOR_DATA;
    if (!kafkaTopic) throw new Error("Kafka topic is not set");
    return kafkaTopic;
};

// Schema Registry configuration
let schemaRegistryConfig: SchemaRegistryConfig | undefined = undefined;

const getSchemaRegistryConfig = (): SchemaRegistryConfig => {
    if (schemaRegistryConfig) return schemaRegistryConfig;
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
            `Schema Registry configuration is not set: SCHEMA_REGISTRY_URL=${SCHEMA_REGISTRY_URL}`
        );
    }
    schemaRegistryConfig = {
        url: SCHEMA_REGISTRY_URL,
        auth:
            SCHEMA_REGISTRY_USERNAME && SCHEMA_REGISTRY_PASSWORD
                ? {
                      username: SCHEMA_REGISTRY_USERNAME,
                      password: SCHEMA_REGISTRY_PASSWORD
                  }
                : undefined,
        inputSubject: SERVICE_INPUT_SUBJECT,
        outputSubject: SERVICE_OUTPUT_SUBJECT,
        inputSchemaId: SERVICE_INPUT_SCHEMA_ID,
        outputSchemaId: SERVICE_OUTPUT_SCHEMA_ID,
        validateEnabled: SCHEMA_VALIDATION_ENABLED === "true"
    };
    return schemaRegistryConfig;
};

export type { KafkaConfig, SchemaRegistryConfig };

export { getKafkaConfig, getKafkaTopic, getSchemaRegistryConfig };
