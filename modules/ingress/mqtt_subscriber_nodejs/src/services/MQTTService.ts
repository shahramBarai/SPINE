import mqtt, { MqttClient, IClientOptions, OnConnectCallback, OnMessageCallback, OnErrorCallback, IConnackPacket, IPublishPacket } from "mqtt";
import { getMQTTConfig, MQTTConfig } from "../config";
import { ServiceSchemaManager } from "./SchemaRegistryService";
import { KafkaProducerService } from "./KafkaProducerService";

interface MQTTMessage {
    topic: string;
    payload: Buffer;
    qos: 0 | 1 | 2;
    retain: boolean;
    dup: boolean;
}

interface ConnectionState {
    isConnected: boolean;
    isConnecting: boolean;
    reconnectAttempts: number;
    lastConnectedAt?: Date;
    lastDisconnectedAt?: Date;
}

/**
 * MQTT Subscriber Service
 * Handles MQTT connection, subscription, message processing, and Kafka production
 */
class MQTTService {
    private config: MQTTConfig;
    private client: MqttClient | null = null;
    private connectionState: ConnectionState = {
        isConnected: false,
        isConnecting: false,
        reconnectAttempts: 0,
    };
    private schemaManager: ServiceSchemaManager;
    private kafkaProducer: KafkaProducerService;
    private maxReconnectAttempts = 10;
    private reconnectDelay = 1000; // Start with 1 second
    private maxReconnectDelay = 30000; // Max 30 seconds
    private reconnectMultiplier = 1.5;
    private isShuttingDown = false;

    constructor(schemaManager: ServiceSchemaManager, kafkaProducer: KafkaProducerService) {
        this.config = getMQTTConfig();
        this.schemaManager = schemaManager;
        this.kafkaProducer = kafkaProducer;
    }

    /**
     * Connect to MQTT broker with retry logic
     */
    async connect(): Promise<void> {
        if (this.connectionState.isConnecting || this.connectionState.isConnected) {
            console.log("MQTT connection already in progress or connected");
            return;
        }

        this.connectionState.isConnecting = true;
        this.connectionState.reconnectAttempts++;

        try {
            console.log(`Connecting to MQTT broker: ${this.config.brokerUrl} (attempt ${this.connectionState.reconnectAttempts})`);
            
            const options: IClientOptions = {
                clientId: this.config.clientId,
                clean: this.config.clean,
                keepalive: this.config.keepalive,
                connectTimeout: this.config.connectTimeout,
                reconnectPeriod: 0, // We handle reconnection manually
                username: this.config.username,
                password: this.config.password,
                will: this.config.will,
            };

            this.client = mqtt.connect(this.config.brokerUrl, options);

            // Set up event handlers
            this.setupEventHandlers();

            // Wait for connection
            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error(`Connection timeout after ${this.config.connectTimeout}ms`));
                }, this.config.connectTimeout);

                this.client!.on("connect", () => {
                    clearTimeout(timeout);
                    resolve();
                });

                this.client!.on("error", (error: Error) => {
                    clearTimeout(timeout);
                    reject(error);
                });
            });

            console.log("Successfully connected to MQTT broker");
            this.connectionState.isConnected = true;
            this.connectionState.isConnecting = false;
            this.connectionState.lastConnectedAt = new Date();
            this.connectionState.reconnectAttempts = 0;
            this.reconnectDelay = 1000; // Reset delay

        } catch (error) {
            this.connectionState.isConnecting = false;
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            console.error(`Failed to connect to MQTT broker: ${errorMessage}`);
            
            // Clean up failed connection
            if (this.client) {
                try {
                    this.client.end(true);
                } catch (cleanupError) {
                    console.warn("Error during connection cleanup:", cleanupError);
                }
                this.client = null;
            }
            
            if (!this.isShuttingDown && this.connectionState.reconnectAttempts < this.maxReconnectAttempts) {
                await this.scheduleReconnect();
            } else if (this.connectionState.reconnectAttempts >= this.maxReconnectAttempts) {
                console.error("Max reconnection attempts reached. Giving up.");
                throw new Error(`Failed to connect to MQTT broker after ${this.maxReconnectAttempts} attempts. Last error: ${errorMessage}`);
            }
        }
    }

    /**
     * Set up MQTT event handlers
     */
    private setupEventHandlers(): void {
        if (!this.client) return;

        // Connection event
        this.client.on("connect", this.onConnect.bind(this));

        // Message event
        this.client.on("message", this.onMessage.bind(this));

        // Error event
        this.client.on("error", this.onError.bind(this));

        // Disconnect event
        this.client.on("disconnect", this.onDisconnect.bind(this));

        // Close event
        this.client.on("close", this.onClose.bind(this));

        // Offline event
        this.client.on("offline", this.onOffline.bind(this));

        // Reconnect event
        this.client.on("reconnect", this.onReconnect.bind(this));
    }

    /**
     * Handle successful connection
     */
    private onConnect: OnConnectCallback = (connack: IConnackPacket) => {
        console.log("MQTT client connected", { connack });
        this.connectionState.isConnected = true;
        this.connectionState.isConnecting = false;
        this.connectionState.lastConnectedAt = new Date();
        this.connectionState.reconnectAttempts = 0;
        this.reconnectDelay = 1000; // Reset delay

        // Subscribe to configured topics
        this.subscribeToTopics();
    };

    /**
     * Handle incoming messages
     */
    private onMessage: OnMessageCallback = async (topic: string, payload: Buffer, packet: IPublishPacket) => {
        try {
            console.log(`Received MQTT message on topic: ${topic}`);
            
            const message: MQTTMessage = {
                topic,
                payload,
                qos: packet.qos,
                retain: packet.retain,
                dup: packet.dup,
            };

            await this.processMessage(message);
        } catch (error) {
            console.error(`Error processing MQTT message from topic ${topic}:`, error);
        }
    };

    /**
     * Handle connection errors
     */
    private onError: OnErrorCallback = (error) => {
        console.error("MQTT client error:", error);
        this.connectionState.isConnected = false;
        this.connectionState.lastDisconnectedAt = new Date();
    };

    /**
     * Handle disconnection
     */
    private onDisconnect = (packet: any) => {
        console.log("MQTT client disconnected", { packet });
        this.connectionState.isConnected = false;
        this.connectionState.lastDisconnectedAt = new Date();
        
        if (!this.isShuttingDown) {
            this.scheduleReconnect();
        }
    };

    /**
     * Handle connection close
     */
    private onClose = () => {
        console.log("MQTT client connection closed");
        this.connectionState.isConnected = false;
        this.connectionState.lastDisconnectedAt = new Date();
    };

    /**
     * Handle going offline
     */
    private onOffline = () => {
        console.log("MQTT client went offline");
        this.connectionState.isConnected = false;
        this.connectionState.lastDisconnectedAt = new Date();
    };

    /**
     * Handle reconnection
     */
    private onReconnect = () => {
        console.log("MQTT client reconnecting...");
        this.connectionState.isConnecting = true;
    };

    /**
     * Subscribe to configured topics
     */
    private async subscribeToTopics(): Promise<void> {
        if (!this.client || !this.connectionState.isConnected) {
            console.warn("Cannot subscribe to topics: client not connected");
            return;
        }

        try {
            console.log(`Subscribing to topics: ${this.config.topics.join(", ")}`);
            
            await new Promise<void>((resolve, reject) => {
                this.client!.subscribe(this.config.topics, { qos: this.config.qos }, (error: Error | null) => {
                    if (error) {
                        console.error("Failed to subscribe to topics:", error);
                        reject(error);
                    } else {
                        console.log("Successfully subscribed to all topics");
                        resolve();
                    }
                });
            });
        } catch (error) {
            console.error("Error subscribing to topics:", error);
            throw error;
        }
    }

    /**
     * Process incoming MQTT message
     */
    private async processMessage(message: MQTTMessage): Promise<void> {
        try {
            // Decode payload
            const payloadString = message.payload.toString();
            console.log(`Processing message from topic ${message.topic}:`, payloadString);

            let parsedMessage: any;
            try {
                parsedMessage = JSON.parse(payloadString);
            } catch (error) {
                console.error(`Failed to parse JSON payload from topic ${message.topic}:`, error);
                return;
            }

            // Validate against input schema
            const isInputValid = this.schemaManager.validateInputMessage(parsedMessage);
            if (!isInputValid) {
                console.error(`Input message validation failed for topic ${message.topic}`);
                return;
            }

            // Transform message (add processing metadata)
            const processedMessage = {
                ...parsedMessage,
                mqtt_topic: message.topic,
                mqtt_qos: message.qos,
                mqtt_retain: message.retain,
                mqtt_dup: message.dup,
                received_at: new Date().toISOString(),
                processed_at: new Date().toISOString(),
                processing_service: process.env.SERVICE_NAME || "mqtt-subscriber",
                processing_version: process.env.SERVICE_VERSION || "1.0.0",
            };

            // Validate against output schema
            const isOutputValid = this.schemaManager.validateOutputMessage(processedMessage);
            if (!isOutputValid) {
                console.error(`Output message validation failed for topic ${message.topic}`);
                return;
            }

            // Send to Kafka
            await this.kafkaProducer.sendMessage(JSON.stringify(processedMessage));
            console.log(`Successfully processed and sent message from topic ${message.topic} to Kafka`);

        } catch (error) {
            console.error(`Error processing message from topic ${message.topic}:`, error);
        }
    }

    /**
     * Schedule reconnection with exponential backoff
     */
    private async scheduleReconnect(): Promise<void> {
        if (this.isShuttingDown) return;

        const delay = Math.min(this.reconnectDelay, this.maxReconnectDelay);
        console.log(`Scheduling reconnection in ${delay}ms (attempt ${this.connectionState.reconnectAttempts + 1})`);

        setTimeout(async () => {
            if (!this.isShuttingDown) {
                this.reconnectDelay *= this.reconnectMultiplier;
                await this.connect();
            }
        }, delay);
    }

    /**
     * Disconnect from MQTT broker
     */
    async disconnect(): Promise<void> {
        this.isShuttingDown = true;
        
        if (this.client) {
            try {
                console.log("Disconnecting from MQTT broker...");
                await new Promise<void>((resolve) => {
                    this.client!.end(false, {}, () => {
                        console.log("MQTT client disconnected gracefully");
                        resolve();
                    });
                });
            } catch (error) {
                console.error("Error during MQTT disconnect:", error);
            }
        }

        this.connectionState.isConnected = false;
        this.connectionState.isConnecting = false;
    }

    /**
     * Get connection state
     */
    getConnectionState(): ConnectionState {
        return { ...this.connectionState };
    }

    /**
     * Check if client is connected
     */
    isConnected(): boolean {
        return this.connectionState.isConnected && this.client?.connected === true;
    }

    /**
     * Health check
     */
    async healthCheck(): Promise<{
        status: string;
        timestamp: string;
        connectionState: ConnectionState;
        error?: string;
    }> {
        try {
            const isConnected = this.isConnected();
            return {
                status: isConnected ? "connected" : "disconnected",
                timestamp: new Date().toISOString(),
                connectionState: this.getConnectionState(),
                error: isConnected ? undefined : "Not connected to MQTT broker",
            };
        } catch (error) {
            return {
                status: "error",
                timestamp: new Date().toISOString(),
                connectionState: this.getConnectionState(),
                error: error instanceof Error ? error.message : "Unknown error",
            };
        }
    }

    /**
     * Test MQTT broker connectivity without subscribing
     */
    async testConnection(): Promise<{
        success: boolean;
        error?: string;
        latency?: number;
    }> {
        const startTime = Date.now();
        
        try {
            console.log(`Testing connection to MQTT broker: ${this.config.brokerUrl}`);
            
            const options: IClientOptions = {
                clientId: `${this.config.clientId}-test`,
                clean: true,
                keepalive: 10,
                connectTimeout: 10000, // Shorter timeout for testing
                reconnectPeriod: 0,
                username: this.config.username,
                password: this.config.password,
            };

            const testClient = mqtt.connect(this.config.brokerUrl, options);
            
            const result = await new Promise<{ success: boolean; error?: string }>((resolve) => {
                const timeout = setTimeout(() => {
                    testClient.end(true);
                    resolve({ success: false, error: "Connection test timeout" });
                }, 10000);

                testClient.on("connect", () => {
                    clearTimeout(timeout);
                    testClient.end(true);
                    resolve({ success: true });
                });

                testClient.on("error", (error: Error) => {
                    clearTimeout(timeout);
                    testClient.end(true);
                    resolve({ success: false, error: error.message });
                });
            });

            const latency = Date.now() - startTime;
            
            if (result.success) {
                console.log(`✅ MQTT broker connection test successful (${latency}ms)`);
            } else {
                console.log(`❌ MQTT broker connection test failed: ${result.error}`);
            }

            return {
                ...result,
                latency,
            };
        } catch (error) {
            const latency = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            console.log(`❌ MQTT broker connection test failed: ${errorMessage}`);
            
            return {
                success: false,
                error: errorMessage,
                latency,
            };
        }
    }

    /**
     * Get configuration info (without sensitive data)
     */
    getConfigInfo(): {
        brokerUrl: string;
        clientId: string;
        topics: string[];
        qos: number;
        clean: boolean;
        keepalive: number;
        reconnectPeriod: number;
        connectTimeout: number;
        hasAuth: boolean;
        hasWill: boolean;
    } {
        return {
            brokerUrl: this.config.brokerUrl,
            clientId: this.config.clientId,
            topics: this.config.topics,
            qos: this.config.qos,
            clean: this.config.clean,
            keepalive: this.config.keepalive,
            reconnectPeriod: this.config.reconnectPeriod,
            connectTimeout: this.config.connectTimeout,
            hasAuth: !!(this.config.username && this.config.password),
            hasWill: !!this.config.will,
        };
    }
}

export { MQTTService, type MQTTMessage, type ConnectionState };
