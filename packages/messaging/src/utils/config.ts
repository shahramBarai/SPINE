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


export {
    getKafkaConfig,
    getKafkaTopic,
    getSchemaRegistryConfig,
    type SchemaRegistryConfig,
};

