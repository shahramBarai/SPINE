import dotenv from "dotenv";
dotenv.config();

const clientId = process.env.CLIENT_ID;
if (!clientId) {
    throw new Error("CLIENT_ID is not set");
}

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
        throw new Error("Kafka configuration is not set");
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
    kafkaTopic = process.env.KAFKA_TOPIC;
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
    const SCHEMA_REGISTRY_INPUT_SUBJECT =
        process.env.SCHEMA_REGISTRY_INPUT_SUBJECT;
    const SCHEMA_REGISTRY_OUTPUT_SUBJECT =
        process.env.SCHEMA_REGISTRY_OUTPUT_SUBJECT;
    const SCHEMA_REGISTRY_INPUT_SCHEMA_ID =
        process.env.SCHEMA_REGISTRY_INPUT_SCHEMA_ID;
    const SCHEMA_REGISTRY_OUTPUT_SCHEMA_ID =
        process.env.SCHEMA_REGISTRY_OUTPUT_SCHEMA_ID;
    const SCHEMA_REGISTRY_VALIDATE_ENABLED =
        process.env.SCHEMA_REGISTRY_VALIDATE_ENABLED;

    if (
        !SCHEMA_REGISTRY_URL ||
        !SCHEMA_REGISTRY_VALIDATE_ENABLED ||
        !SCHEMA_REGISTRY_INPUT_SUBJECT ||
        !SCHEMA_REGISTRY_OUTPUT_SUBJECT
    ) {
        throw new Error("Schema Registry configuration is not set");
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
        inputSubject: SCHEMA_REGISTRY_INPUT_SUBJECT,
        outputSubject: SCHEMA_REGISTRY_OUTPUT_SUBJECT,
        inputSchemaId: SCHEMA_REGISTRY_INPUT_SCHEMA_ID,
        outputSchemaId: SCHEMA_REGISTRY_OUTPUT_SCHEMA_ID,
        validateEnabled: SCHEMA_REGISTRY_VALIDATE_ENABLED === "true",
    };
    return schemaRegistryConfig;
};

export {
    getKafkaConfig,
    getKafkaTopic,
    getSchemaRegistryConfig,
    type SchemaRegistryConfig,
};
