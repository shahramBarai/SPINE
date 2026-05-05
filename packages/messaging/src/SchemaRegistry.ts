import { type SchemaRegistryConfig } from "./utils/config";
import z from "zod";
import { convertAvroToZod } from "./utils/zodSchemaValidator";
import { logger } from "@spine/shared";

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
class SchemaRegistry {
    private config: SchemaRegistryConfig;

    constructor(config: SchemaRegistryConfig) {
        this.config = config;
    }

    /**
     * Make an HTTP request to the schema registry with proper headers and error handling
     *
     * @param endpoint API endpoint to call (e.g., "/schemas/ids/{id}")
     * @param options Fetch options (method, body, headers, etc.)
     * @return Parsed JSON response from the schema registry
     * @throws Error if the request fails or the response is not OK
     */
    private async makeRequest<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const url = `${this.config.url}${endpoint}`;
        const headers: Record<string, string> = {
            "Content-Type": "application/vnd.schemaregistry.v1+json",
            ...((options.headers as Record<string, string>) || {}),
        };

        if (this.config.auth) {
            const encoded = Buffer.from(
                `${this.config.auth.username}:${this.config.auth.password}`
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
                `Failed to make request to ${url}: ${errorData.message}`
            );
        }

        return response.json();
    }

    /**
     * Get schema by its unique ID
     *
     * @param id Schema ID to retrieve
     * @return SchemaVersion object containing schema details
     * @throws Error if the request fails or the response is not OK
     */
    async getSchemaById(id: string): Promise<SchemaVersion> {
        return await this.makeRequest(`/schemas/ids/${id}`);
    }

    /**
     * Get the latest version of a schema for a subject
     *
     * @param subject Subject name to retrieve the latest schema for
     * @return SchemaVersion object containing the latest schema details for the subject
     * @throws Error if the request fails or the response is not OK
     */
    async getLatestSchema(subject: string): Promise<SchemaVersion> {
        return await this.makeRequest(
            `/subjects/${encodeURIComponent(subject)}/versions/latest`
        );
    }

    /**
     * Get a specific version of a schema for a subject
     *
     * @param subject Subject name to retrieve the schema for
     * @param version Version number to retrieve (or "latest" for the latest version)
     * @return SchemaVersion object containing the schema details for the specified version
     * @throws Error if the request fails or the response is not OK
     */
    async getSchemaByVersion(
        subject: string,
        version: number
    ): Promise<SchemaVersion> {
        return await this.makeRequest(
            `/subjects/${encodeURIComponent(subject)}/versions/${version}`
        );
    }

    /**
     * Check if a schema is compatible with a specific version
     *
     * @param subject Subject name to check compatibility for
     * @param version Version number to check compatibility against (or "latest" for the latest version)
     * @param schema Schema string to check for compatibility
     * @return CompatibilityCheckResponse indicating if the schema is compatible and any messages
     * @throws Error if the request fails or the response is not OK
     */
    async checkCompatibility(
        subject: string,
        version: number | "latest",
        schema: string
    ): Promise<CompatibilityCheckResponse> {
        return await this.makeRequest(
            `/compatibility/subjects/${encodeURIComponent(subject)}/versions/${version}`,
            {
                method: "POST",
                body: JSON.stringify({ schema }),
            }
        );
    }

    /**
     * List all subjects in the registry
     *
     * @return Array of subject names
     * @throws Error if the request fails or the response is not OK
     */
    async listSubjects(): Promise<string[]> {
        return await this.makeRequest("/subjects");
    }

    /**
     * Get all versions for a subject
     *
     * @param subject Subject name to retrieve versions for
     * @return Array of version numbers for the specified subject
     * @throws Error if the request fails or the response is not OK
     */
    async getSubjectVersions(subject: string): Promise<number[]> {
        return await this.makeRequest(
            `/subjects/${encodeURIComponent(subject)}/versions`
        );
    }

    /**
     * Validate that a schema string is properly formatted
     *
     * @param schema Schema string to validate
     * @param schemaType Type of the schema (AVRO, JSON, PROTOBUF)
     * @return Promise resolving to true if the schema is valid, false otherwise
     * @throws Error if the request fails or the response is not OK
     */
    async validateSchema(
        schema: string,
        schemaType: "AVRO" | "JSON" | "PROTOBUF" = "AVRO"
    ): Promise<boolean> {
        if (schemaType === "AVRO") {
            JSON.parse(schema);
        }
        return true;
    }

    /**
     * Initialize service schemas - get input and output schemas for the service
     *
     * @return Object containing input and output SchemaVersion objects
     * @throws Error if the request fails or the response is not OK
     */
    async initializeServiceSchemas(): Promise<{
        inputSchema: SchemaVersion;
        outputSchema: SchemaVersion;
    }> {
        try {
            let inputSchema: SchemaVersion;
            let outputSchema: SchemaVersion;

            // Get input schema
            if (this.config.inputSchemaId) {
                inputSchema = await this.getSchemaById(
                    this.config.inputSchemaId
                );
            } else {
                inputSchema = await this.getLatestSchema(
                    this.config.inputSubject
                );
            }

            // Get output schema
            if (this.config.outputSchemaId) {
                outputSchema = await this.getSchemaById(
                    this.config.outputSchemaId
                );
            } else {
                outputSchema = await this.getLatestSchema(
                    this.config.outputSubject
                );
            }

            return { inputSchema, outputSchema };
        } catch (error: unknown) {
            throw new Error(
                `Failed to initialize service schemas: ${error instanceof Error ? error.message : "Unknown error"}`,
                { cause: error }
            );
        }
    }

    /**
     * Health check - verify connection to schema registry
     *
     * @return Object containing connection status, timestamp, and optional error message if disconnected
     * @throws Error if the request fails or the response is not OK
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
 * Handles initialization, management, and monitoring of input/output schemas for the MQTT subscriber service
 */
class ServiceSchemaManager {
    private schemaRegistry: SchemaRegistry;
    private inputSchema: SchemaVersion | null = null;
    private outputSchema: SchemaVersion | null = null;
    private inputZodSchema: z.ZodSchema | null = null;
    private outputZodSchema: z.ZodSchema | null = null;
    private config: SchemaRegistryConfig;

    private isInitialized = false;
    private validateEnabled = false;

    // Schema monitoring properties
    private isMonitoring = false;
    private checkInterval: number = 30000; // 30 seconds default
    private intervalId: NodeJS.Timeout | null = null;
    private lastCheckTime = 0;

    /**
     * Initialize service schemas from environment configuration
     */
    constructor(config: SchemaRegistryConfig) {
        this.config = config;
        this.schemaRegistry = new SchemaRegistry(config);
    }

    /**
     * Initialize service schemas
     */
    async initialize(): Promise<boolean> {
        try {
            logger.debug(
                "Schema registry service: Initializing service schemas..."
            );
            while (
                (await this.schemaRegistry.healthCheck()).status !== "connected"
            ) {
                await new Promise((resolve) => setTimeout(resolve, 1000));
                logger.debug(
                    "Schema registry service: Waiting for schema registry to be connected..."
                );
            }
            logger.debug(
                "Schema registry service: Connected, initializing service schemas..."
            );
            const schemas =
                await this.schemaRegistry.initializeServiceSchemas();
            this.inputSchema = schemas.inputSchema;
            this.outputSchema = schemas.outputSchema;
            this.inputZodSchema = convertAvroToZod(schemas.inputSchema.schema);
            this.outputZodSchema = convertAvroToZod(
                schemas.outputSchema.schema
            );

            this.isInitialized = true;
            this.validateEnabled = this.config.validateEnabled;

            logger.info(
                "Schema registry service: Service schemas initialized successfully."
            );
            return true;
        } catch (error) {
            logger.error(
                "Schema registry service: Failed to initialize service schemas:",
                error
            );
            return false;
        }
    }

    /**
     * Get the input schema for validating incoming MQTT messages
     */
    getInputSchema(): SchemaVersion {
        if (!this.isInitialized || !this.inputSchema) {
            throw new Error(
                "Schema registry service: Service schemas not initialized. Call initialize() first."
            );
        }
        return this.inputSchema;
    }

    /**
     * Get the output schema for validating outgoing Kafka messages
     */
    getOutputSchema(): SchemaVersion {
        if (!this.isInitialized || !this.outputSchema) {
            throw new Error(
                "Schema registry service: Service schemas not initialized. Call initialize() first."
            );
        }
        return this.outputSchema;
    }

    private validateMessage(
        message: string | object,
        schema: z.ZodSchema
    ): { success: boolean; data?: unknown; error?: string } {
        try {
            const parsedMessage =
                typeof message === "string" ? JSON.parse(message) : message;
            const result = schema.safeParse(parsedMessage);
            if (result.success) {
                return { success: true, data: result.data };
            } else {
                const errorMessages = result.error.issues
                    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
                    .join(", ");
                return {
                    success: false,
                    error: `Validation failed: ${errorMessages}`,
                };
            }
        } catch (error: unknown) {
            return {
                success: false,
                error: `Parse error: ${error instanceof Error ? error.message : "Unknown error"}`,
            };
        }
    }

    /**
     * Validate incoming MQTT message against input schema using Zod
     */
    validateInputMessage(message: string | object): {
        success: boolean;
        data?: unknown;
        error?: string;
    } {
        if (!this.isInitialized || !this.inputZodSchema) {
            return {
                success: false,
                error: "Service schemas not initialized. Call initialize() first.",
            };
        }

        if (!this.validateEnabled) {
            return { success: true, data: message }; // Skip validation if disabled
        }

        const result = this.validateMessage(message, this.inputZodSchema);

        if (!result.success) {
            logger.warn(
                `Schema registry service: Input message validation failed: ${result.error}`
            );
        }

        return result;
    }

    /**
     * Validate outgoing Kafka message against output schema using Zod
     */
    validateOutputMessage(message: string | object): {
        success: boolean;
        data?: unknown;
        error?: string;
    } {
        if (!this.isInitialized || !this.outputZodSchema) {
            return {
                success: false,
                error: "Service schemas not initialized. Call initialize() first.",
            };
        }

        if (!this.validateEnabled) {
            return { success: true, data: message }; // Skip validation if disabled
        }

        const result = this.validateMessage(message, this.outputZodSchema);

        if (!result.success) {
            logger.warn(
                `Schema registry service: Output message validation failed: ${result.error}`
            );
        }

        return result;
    }

    /**
     * Get schema information for logging/debugging
     *
     * @return Object containing input and output schema IDs, versions, subjects, and initialization status
     * @throws Error if the service schemas are not initialized
     */
    getSchemaInfo(): {
        input: { id: number; version: number; subject: string };
        output: { id: number; version: number; subject: string };
        isInitialized: boolean;
    } {
        if (!this.isInitialized || !this.inputSchema || !this.outputSchema) {
            throw new Error(
                "Schema registry service: Service schemas not initialized. Call initialize() first."
            );
        }

        return {
            input: {
                id: this.inputSchema.id,
                version: this.inputSchema.version,
                subject: this.inputSchema.subject,
            },
            output: {
                id: this.outputSchema.id,
                version: this.outputSchema.version,
                subject: this.outputSchema.subject,
            },
            isInitialized: this.isInitialized,
        };
    }

    /**
     * Check for schema updates and refresh if needed
     */
    async checkForSchemaUpdates(): Promise<{
        inputUpdated: boolean;
        outputUpdated: boolean;
        errors?: string[];
    }> {
        if (!this.isInitialized || !this.inputSchema || !this.outputSchema) {
            return { inputUpdated: false, outputUpdated: false };
        }

        const errors: string[] = [];
        let inputUpdated = false;
        let outputUpdated = false;

        try {
            // Check input schema for updates
            const latestInputSchema = await this.schemaRegistry.getLatestSchema(
                this.inputSchema.subject
            );
            if (latestInputSchema.version > this.inputSchema.version) {
                this.inputZodSchema = convertAvroToZod(
                    latestInputSchema.schema
                );
                inputUpdated = true;
            }

            // Check output schema for updates
            const latestOutputSchema =
                await this.schemaRegistry.getLatestSchema(
                    this.outputSchema.subject
                );
            this.outputZodSchema = convertAvroToZod(latestOutputSchema.schema);
            outputUpdated = true;
        } catch (error) {
            const errorMsg = `Failed to check for schema updates: ${error instanceof Error ? error.message : "Unknown error"}`;
            errors.push(errorMsg);
            logger.error("Schema registry service:", errorMsg);
        }

        return {
            inputUpdated,
            outputUpdated,
            errors: errors.length > 0 ? errors : undefined,
        };
    }

    /**
     * Check for schema updates (internal method)
     */
    private async checkForUpdates(): Promise<void> {
        try {
            const startTime = Date.now();
            const result = await this.checkForSchemaUpdates();
            const duration = Date.now() - startTime;

            if (result.inputUpdated || result.outputUpdated) {
                logger.debug(
                    `Schema updates detected - Input: ${result.inputUpdated}, Output: ${result.outputUpdated} (${duration}ms)`
                );

                // Log current schema versions
                const schemaInfo = this.getSchemaInfo();
                logger.debug(
                    `Current schema versions - Input: ${schemaInfo.input.version}, Output: ${schemaInfo.output.version}`
                );
            }

            if (result.errors && result.errors.length > 0) {
                logger.error(
                    "Schema registry service: Schema update check failed:",
                    result.errors
                );
            }

            this.lastCheckTime = Date.now();
        } catch (error) {
            logger.error(
                "Schema registry service: Failed to check for schema updates:",
                error
            );
        }
    }

    /**
     * Start monitoring for schema changes
     */
    startMonitoring(checkIntervalMs: number = 30000): void {
        if (this.isMonitoring) {
            logger.warn("Schema monitoring is already running");
            return;
        }

        if (!this.isInitialized) {
            throw new Error(
                "Schema manager must be initialized before starting monitoring"
            );
        }

        this.isMonitoring = true;
        this.checkInterval = checkIntervalMs;
        this.lastCheckTime = Date.now();

        logger.debug(
            `Schema registry service: Starting schema monitoring with ${this.checkInterval}ms interval`
        );

        this.intervalId = setInterval(async () => {
            await this.checkForUpdates();
        }, this.checkInterval);

        // Initial check
        this.checkForUpdates();
    }

    /**
     * Stop monitoring for schema changes
     */
    stopMonitoring(): void {
        if (!this.isMonitoring) {
            logger.warn("Schema monitoring is not running");
            return;
        }

        this.isMonitoring = false;

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        logger.debug("Schema registry service: Schema monitoring stopped");
    }

    /**
     * Force an immediate schema update check
     */
    async forceUpdateCheck(): Promise<{
        inputUpdated: boolean;
        outputUpdated: boolean;
        errors?: string[];
    }> {
        logger.debug("Schema registry service: Forcing schema update check");
        return await this.checkForSchemaUpdates();
    }

    /**
     * Get monitoring status
     */
    getMonitoringStatus(): {
        isMonitoring: boolean;
        checkInterval: number;
        lastCheckTime: number;
    } {
        return {
            isMonitoring: this.isMonitoring,
            checkInterval: this.checkInterval,
            lastCheckTime: this.lastCheckTime,
        };
    }

    /**
     * Update monitoring check interval
     */
    setMonitoringInterval(intervalMs: number): void {
        if (intervalMs < 1000) {
            throw new Error("Check interval must be at least 1000ms");
        }

        this.checkInterval = intervalMs;

        if (this.isMonitoring && this.intervalId) {
            // Restart with new interval
            clearInterval(this.intervalId);
            this.intervalId = setInterval(async () => {
                await this.checkForUpdates();
            }, this.checkInterval);

            logger.debug(
                `Schema registry service: Schema monitoring interval updated to ${intervalMs}ms`
            );
        }
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
