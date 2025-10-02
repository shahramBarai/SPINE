import z from "zod";
import { getSchemaRegistryConfig, SchemaRegistryConfig } from "../utils/config";
import { logger } from "../utils/logger";
import { convertAvroToZod } from "../utils/zodSchemaValidator";

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
        this.config = getSchemaRegistryConfig();
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
    async getSchemaById(id: string): Promise<SchemaVersion> {
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
                    this.config.inputSchemaId,
                );
            } else {
                inputSchema = await this.getLatestSchema(
                    this.config.inputSubject,
                );
            }

            // Get output schema
            if (this.config.outputSchemaId) {
                outputSchema = await this.getSchemaById(
                    this.config.outputSchemaId,
                );
            } else {
                outputSchema = await this.getLatestSchema(
                    this.config.outputSubject,
                );
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
 * Handles initialization, management, and monitoring of input/output schemas for the MQTT subscriber service
 */
class ServiceSchemaManager {
    private schemaRegistry = new SchemaRegistryService();
    private inputSchema: any = null;
    private outputSchema: any = null;
    private inputZodSchema: z.ZodSchema | null = null;
    private outputZodSchema: z.ZodSchema | null = null;

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
    async initialize(): Promise<boolean> {
        try {
            logger.debug(
                "Schema registry service: Initializing service schemas...",
            );
            while (
                (await this.schemaRegistry.healthCheck()).status !== "connected"
            ) {
                await new Promise((resolve) => setTimeout(resolve, 1000));
                logger.debug(
                    "Schema registry service: Waiting for schema registry to be connected...",
                );
            }
            logger.debug(
                "Schema registry service: Connected, initializing service schemas...",
            );
            const schemas =
                await this.schemaRegistry.initializeServiceSchemas();
            this.inputSchema = schemas.inputSchema;
            this.outputSchema = schemas.outputSchema;
            this.inputZodSchema = convertAvroToZod(schemas.inputSchema.schema);
            this.outputZodSchema = convertAvroToZod(
                schemas.outputSchema.schema,
            );

            this.isInitialized = true;
            this.validateEnabled = getSchemaRegistryConfig().validateEnabled;

            logger.info(
                "Schema registry service: Service schemas initialized successfully.",
            );
            return true;
        } catch (error) {
            logger.error(
                "Schema registry service: Failed to initialize service schemas:",
                error,
            );
            return false;
        }
    }

    /**
     * Get the input schema for validating incoming MQTT messages
     */
    getInputSchema(): any {
        if (!this.isInitialized) {
            throw new Error(
                "Schema registry service: Service schemas not initialized. Call initialize() first.",
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

    private validateMessage(
        message: any,
        schema: z.ZodSchema,
    ): { success: boolean; data?: any; error?: string } {
        try {
            const parsedMessage =
                typeof message === "string" ? JSON.parse(message) : message;
            const result = schema.safeParse(parsedMessage);
            if (result.success) {
                return { success: true, data: result.data };
            } else {
                const errorMessages = result.error.errors
                    .map((err) => `${err.path.join(".")}: ${err.message}`)
                    .join(", ");
                return {
                    success: false,
                    error: `Validation failed: ${errorMessages}`,
                };
            }
        } catch (error) {
            return {
                success: false,
                error: `Parse error: ${error instanceof Error ? error.message : "Unknown error"}`,
            };
        }
    }

    /**
     * Validate incoming MQTT message against input schema using Zod
     */
    validateInputMessage(message: any): {
        success: boolean;
        data?: any;
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
                `Schema registry service: Input message validation failed: ${result.error}`,
            );
        }

        return result;
    }

    /**
     * Validate outgoing Kafka message against output schema using Zod
     */
    validateOutputMessage(message: any): {
        success: boolean;
        data?: any;
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
                `Schema registry service: Output message validation failed: ${result.error}`,
            );
        }

        return result;
    }

    /**
     * Get schema information for logging/debugging
     */
    getSchemaInfo(): {
        input: { id: string; version: string; subject: string };
        output: { id: string; version: string; subject: string };
        isInitialized: boolean;
    } {
        return {
            input: {
                id: this.inputSchema?.id || "unknown",
                version: this.inputSchema?.version || "unknown",
                subject: this.inputSchema?.subject || "unknown",
            },
            output: {
                id: this.outputSchema?.id || "unknown",
                version: this.outputSchema?.version || "unknown",
                subject: this.outputSchema?.subject || "unknown",
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
        if (!this.isInitialized) {
            return { inputUpdated: false, outputUpdated: false };
        }

        const errors: string[] = [];
        let inputUpdated = false;
        let outputUpdated = false;

        try {
            // Check input schema for updates
            const latestInputSchema = await this.schemaRegistry.getLatestSchema(
                this.inputSchema.subject,
            );
            if (latestInputSchema.version > this.inputSchema.version) {
                this.inputZodSchema = convertAvroToZod(
                    latestInputSchema.schema,
                );
                inputUpdated = true;
            }

            // Check output schema for updates
            const latestOutputSchema =
                await this.schemaRegistry.getLatestSchema(
                    this.outputSchema.subject,
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
                    `Schema updates detected - Input: ${result.inputUpdated}, Output: ${result.outputUpdated} (${duration}ms)`,
                );

                // Log current schema versions
                const schemaInfo = this.getSchemaInfo();
                logger.debug(
                    `Current schema versions - Input: ${schemaInfo.input.version}, Output: ${schemaInfo.output.version}`,
                );
            }

            if (result.errors && result.errors.length > 0) {
                logger.error(
                    "Schema registry service: Schema update check failed:",
                    result.errors,
                );
            }

            this.lastCheckTime = Date.now();
        } catch (error) {
            logger.error(
                "Schema registry service: Failed to check for schema updates:",
                error,
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
                "Schema manager must be initialized before starting monitoring",
            );
        }

        this.isMonitoring = true;
        this.checkInterval = checkIntervalMs;
        this.lastCheckTime = Date.now();

        logger.debug(
            `Schema registry service: Starting schema monitoring with ${this.checkInterval}ms interval`,
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
                `Schema registry service: Schema monitoring interval updated to ${intervalMs}ms`,
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
