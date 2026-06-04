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

export { type KafkaConfig, type SchemaRegistryConfig };
