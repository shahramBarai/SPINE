interface SchemaRegistryConfig {
    url: string;
    auth?: {
        username: string;
        password: string;
    };
}

interface ServiceSchemaConfig {
    inputSubject: string;
    outputSubject: string;
    inputSchemaId?: number;
    outputSchemaId?: number;
}

interface SchemaVersion {
    id: number;
    version: number;
    schema: string;
    subject: string;
    schemaType: "AVRO" | "JSON" | "PROTOBUF";
    references?: unknown[];
}

interface CompatibilityCheckResponse {
    is_compatible: boolean;
    messages?: string[];
}

/**
 * Schema Registry Service
 * Handles communication with the Schema Registry service
 */
class SchemaRegistryService {
    private config: SchemaRegistryConfig;

    constructor() {
        const URL = process.env.SCHEMA_REGISTRY_URL || "http://localhost:8081";
        const USERNAME = process.env.SCHEMA_REGISTRY_USERNAME;
        const PASSWORD = process.env.SCHEMA_REGISTRY_PASSWORD;

        this.config = {
            url: URL,
            auth:
                USERNAME && PASSWORD
                    ? {
                          username: USERNAME,
                          password: PASSWORD,
                      }
                    : undefined,
        };
    }

    private async makeRequest<T>(
        endpoint: string,
        options: RequestInit = {},
    ): Promise<T> {
        const url = `${this.config.url}${endpoint}`;
        const headers: Record<string, string> = {
            "Content-Type": "application/vnd.schemaregistry.v1+json",
            ...((options.headers as Record<string, string>) || {}),
        };

        if (this.config.auth) {
            const encoded = Buffer.from(
                `${this.config.auth.username}:${this.config.auth.password}`,
            ).toString("base64");
            headers.Authorization = `Basic ${encoded}`;
        }

        const response = await fetch(url, {
            ...options,
            headers,
        });

        if (!response.ok) {
            const errorData = await response
                .json()
                .catch(() => ({ message: "Unknown error" }));
            throw new Error(
                `Failed to make request to ${url}: ${errorData.message}`,
            );
        }

        return response.json();
    }

    /**
     * Get schema by its unique ID
     */
    async getSchemaById(id: number): Promise<SchemaVersion> {
        try {
            return await this.makeRequest(`/schemas/ids/${id}`);
        } catch (error) {
            throw new Error(
                `Failed to get schema by ID ${id}: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
        }
    }

    /**
     * Get the latest version of a schema for a subject
     */
    async getLatestSchema(subject: string): Promise<SchemaVersion> {
        try {
            return await this.makeRequest(
                `/subjects/${encodeURIComponent(subject)}/versions/latest`,
            );
        } catch (error) {
            throw new Error(
                `Failed to get latest schema for subject ${subject}: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
        }
    }

    /**
     * Get a specific version of a schema for a subject
     */
    async getSchemaByVersion(
        subject: string,
        version: number,
    ): Promise<SchemaVersion> {
        try {
            return await this.makeRequest(
                `/subjects/${encodeURIComponent(subject)}/versions/${version}`,
            );
        } catch (error) {
            throw new Error(
                `Failed to get schema for subject ${subject} version ${version}: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
        }
    }

    /**
     * Check if a schema is compatible with a specific version
     */
    async checkCompatibility(
        subject: string,
        version: number | "latest",
        schema: string,
    ): Promise<CompatibilityCheckResponse> {
        try {
            return await this.makeRequest(
                `/compatibility/subjects/${encodeURIComponent(subject)}/versions/${version}`,
                {
                    method: "POST",
                    body: JSON.stringify({ schema }),
                },
            );
        } catch (error) {
            throw new Error(
                `Failed to check compatibility for subject ${subject}: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
        }
    }

    /**
     * List all subjects in the registry
     */
    async listSubjects(): Promise<string[]> {
        try {
            return await this.makeRequest("/subjects");
        } catch (error) {
            throw new Error(
                `Failed to list subjects: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
        }
    }

    /**
     * Get all versions for a subject
     */
    async getSubjectVersions(subject: string): Promise<number[]> {
        try {
            return await this.makeRequest(
                `/subjects/${encodeURIComponent(subject)}/versions`,
            );
        } catch (error) {
            throw new Error(
                `Failed to get versions for subject ${subject}: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
        }
    }

    /**
     * Validate that a schema string is properly formatted
     */
    async validateSchema(
        schema: string,
        schemaType: "AVRO" | "JSON" | "PROTOBUF" = "AVRO",
    ): Promise<boolean> {
        try {
            if (schemaType === "AVRO") {
                JSON.parse(schema);
            }
            return true;
        } catch (error) {
            throw new Error(
                `Invalid ${schemaType} schema format: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
        }
    }

    /**
     * Initialize service schemas - get input and output schemas for the service
     */
    async initializeServiceSchemas(config: ServiceSchemaConfig): Promise<{
        inputSchema: SchemaVersion;
        outputSchema: SchemaVersion;
    }> {
        try {
            let inputSchema: SchemaVersion;
            let outputSchema: SchemaVersion;

            // Get input schema
            if (config.inputSchemaId) {
                inputSchema = await this.getSchemaById(config.inputSchemaId);
            } else {
                inputSchema = await this.getLatestSchema(config.inputSubject);
            }

            // Get output schema
            if (config.outputSchemaId) {
                outputSchema = await this.getSchemaById(config.outputSchemaId);
            } else {
                outputSchema = await this.getLatestSchema(config.outputSubject);
            }

            return { inputSchema, outputSchema };
        } catch (error) {
            throw new Error(
                `Failed to initialize service schemas: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
        }
    }

    /**
     * Health check - verify connection to schema registry
     */
    async healthCheck(): Promise<{
        status: string;
        timestamp: string;
        error?: string;
    }> {
        try {
            await this.listSubjects();
            return {
                status: "connected",
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            return {
                status: "disconnected",
                error: error instanceof Error ? error.message : "Unknown error",
                timestamp: new Date().toISOString(),
            };
        }
    }
}

/**
 * Service Schema Manager
 * Handles initialization and management of input/output schemas for the MQTT subscriber service
 */
class ServiceSchemaManager {
    private schemaRegistry = new SchemaRegistryService();
    private inputSchema: any = null;
    private outputSchema: any = null;
    private isInitialized = false;

    /**
     * Initialize service schemas from environment configuration
     */
    async initialize(): Promise<void> {
        try {
            const config: ServiceSchemaConfig = {
                inputSubject:
                    process.env.SERVICE_INPUT_SUBJECT || "mqtt-sensor-data",
                outputSubject:
                    process.env.SERVICE_OUTPUT_SUBJECT ||
                    "processed-sensor-data",
                inputSchemaId: process.env.SERVICE_INPUT_SCHEMA_ID
                    ? parseInt(process.env.SERVICE_INPUT_SCHEMA_ID)
                    : undefined,
                outputSchemaId: process.env.SERVICE_OUTPUT_SCHEMA_ID
                    ? parseInt(process.env.SERVICE_OUTPUT_SCHEMA_ID)
                    : undefined,
            };

            console.log("Initializing service schemas...", {
                inputSubject: config.inputSubject,
                outputSubject: config.outputSubject,
                inputSchemaId: config.inputSchemaId,
                outputSchemaId: config.outputSchemaId,
            });

            const schemas =
                await this.schemaRegistry.initializeServiceSchemas(config);
            this.inputSchema = schemas.inputSchema;
            this.outputSchema = schemas.outputSchema;
            this.isInitialized = true;

            console.log("Service schemas initialized successfully:", {
                inputSchema: {
                    id: this.inputSchema.id,
                    version: this.inputSchema.version,
                    subject: this.inputSchema.subject,
                },
                outputSchema: {
                    id: this.outputSchema.id,
                    version: this.outputSchema.version,
                    subject: this.outputSchema.subject,
                },
            });
        } catch (error) {
            console.error("Failed to initialize service schemas:", error);
            throw error;
        }
    }

    /**
     * Get the input schema for validating incoming MQTT messages
     */
    getInputSchema(): any {
        if (!this.isInitialized) {
            throw new Error(
                "Service schemas not initialized. Call initialize() first.",
            );
        }
        return this.inputSchema;
    }

    /**
     * Get the output schema for validating outgoing Kafka messages
     */
    getOutputSchema(): any {
        if (!this.isInitialized) {
            throw new Error(
                "Service schemas not initialized. Call initialize() first.",
            );
        }
        return this.outputSchema;
    }

    /**
     * Validate incoming MQTT message against input schema
     */
    validateInputMessage(message: any): boolean {
        if (!this.isInitialized) {
            throw new Error(
                "Service schemas not initialized. Call initialize() first.",
            );
        }

        if (
            !process.env.SCHEMA_VALIDATION_ENABLED ||
            process.env.SCHEMA_VALIDATION_ENABLED === "true"
        ) {
            // Here you would implement actual schema validation logic
            // For now, we'll do basic validation
            try {
                const parsedMessage =
                    typeof message === "string" ? JSON.parse(message) : message;

                // Basic validation - check if required fields exist
                // This is a simplified example - you'd want to use a proper Avro validator
                const schemaFields = JSON.parse(this.inputSchema.schema).fields;
                for (const field of schemaFields) {
                    if (field.name && !(field.name in parsedMessage)) {
                        console.warn(`Missing required field: ${field.name}`);
                        return false;
                    }
                }

                return true;
            } catch (error) {
                console.error("Input message validation failed:", error);
                return false;
            }
        }

        return true; // Skip validation if disabled
    }

    /**
     * Validate outgoing Kafka message against output schema
     */
    validateOutputMessage(message: any): boolean {
        if (!this.isInitialized) {
            throw new Error(
                "Service schemas not initialized. Call initialize() first.",
            );
        }

        if (
            !process.env.SCHEMA_VALIDATION_ENABLED ||
            process.env.SCHEMA_VALIDATION_ENABLED === "true"
        ) {
            try {
                const parsedMessage =
                    typeof message === "string" ? JSON.parse(message) : message;

                // Basic validation - check if required fields exist
                const schemaFields = JSON.parse(
                    this.outputSchema.schema,
                ).fields;
                for (const field of schemaFields) {
                    if (field.name && !(field.name in parsedMessage)) {
                        console.warn(`Missing required field: ${field.name}`);
                        return false;
                    }
                }

                return true;
            } catch (error) {
                console.error("Output message validation failed:", error);
                return false;
            }
        }

        return true; // Skip validation if disabled
    }

    /**
     * Get schema information for logging/debugging
     */
    getSchemaInfo(): {
        input: { id: number; version: number; subject: string };
        output: { id: number; version: number; subject: string };
        isInitialized: boolean;
    } {
        return {
            input: {
                id: this.inputSchema?.id || 0,
                version: this.inputSchema?.version || 0,
                subject: this.inputSchema?.subject || "unknown",
            },
            output: {
                id: this.outputSchema?.id || 0,
                version: this.outputSchema?.version || 0,
                subject: this.outputSchema?.subject || "unknown",
            },
            isInitialized: this.isInitialized,
        };
    }

    /**
     * Health check for schema registry connection
     */
    async healthCheck(): Promise<{
        status: string;
        timestamp: string;
        error?: string;
    }> {
        return await this.schemaRegistry.healthCheck();
    }
}

export { ServiceSchemaManager };