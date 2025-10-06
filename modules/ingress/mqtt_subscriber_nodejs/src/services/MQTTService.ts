import mqtt, {
    MqttClient,
    IClientOptions,
    OnConnectCallback,
    OnMessageCallback,
    OnErrorCallback,
    IConnackPacket,
    IPublishPacket,
} from "mqtt";
import { getMQTTConfig, MQTTConfig } from "../utils/config";
import { ServiceSchemaManager } from "./SchemaRegistryService";
import { KafkaProducerService } from "./KafkaProducerService";
import { logger } from "../utils/logger";

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

    constructor(
        schemaManager: ServiceSchemaManager,
        kafkaProducer: KafkaProducerService,
    ) {
        this.config = getMQTTConfig();
        this.schemaManager = schemaManager;
        this.kafkaProducer = kafkaProducer;
    }

    /**
     * Initialize MQTT connection with retry logic
     */
    initialize(): void {
        if (
            this.connectionState.isConnecting ||
            this.connectionState.isConnected
        ) {
            logger.info(
                "MQTT service: Connection already in progress or connected",
            );
            return;
        }

        this.connectionState.isConnecting = true;
        this.connectionState.reconnectAttempts++;
        logger.debug(`MQTT service: Connecting to MQTT broker...`);

        const options: IClientOptions = {
            clientId: this.config.clientId,
            clean: this.config.clean,
            keepalive: this.config.keepalive,
            connectTimeout: this.config.connectTimeout,
            reconnectPeriod: this.config.reconnectPeriod,
            username: this.config.username,
            password: this.config.password,
            will: this.config.will,
        };

        this.client = mqtt.connect(this.config.brokerUrl, options);

        // Set up event handlers
        this.setupEventHandlers();
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
        logger.info("MQTT service: Client connected", { connack });
        this.connectionState.isConnected = true;
        this.connectionState.isConnecting = false;
        this.connectionState.lastConnectedAt = new Date();
        this.connectionState.reconnectAttempts = 0;

        // Subscribe to configured topics
        this.subscribeToTopics();
    };

    /**
     * Handle incoming messages
     */
    private onMessage: OnMessageCallback = async (
        topic: string,
        payload: Buffer,
    ) => {
        const receivedTime = new Date().getTime();
        try {
            await this.processMessage(topic, payload, receivedTime);
        } catch (error) {
            logger.error(
                `MQTT service: Error processing MQTT message from topic ${topic}:`,
                error,
            );
        }
    };

    /**
     * Handle connection errors
     */
    private onError: OnErrorCallback = (error) => {
        logger.warn("MQTT service: Client error:", error);
        this.connectionState.isConnected = false;
        this.connectionState.lastDisconnectedAt = new Date();
    };

    /**
     * Handle disconnection
     */
    private onDisconnect = (packet: any) => {
        logger.info("MQTT service: Client disconnected", { packet });
        this.connectionState.isConnected = false;
        this.connectionState.lastDisconnectedAt = new Date();
    };

    /**
     * Handle connection close
     */
    private onClose = () => {
        logger.warn("MQTT service: Client connection closed");
        this.connectionState.isConnected = false;
        this.connectionState.lastDisconnectedAt = new Date();
    };

    /**
     * Handle going offline
     */
    private onOffline = () => {
        logger.warn("MQTT service: Client went offline");
        this.connectionState.isConnected = false;
        this.connectionState.lastDisconnectedAt = new Date();
    };

    /**
     * Handle reconnection
     */
    private onReconnect = () => {
        this.connectionState.reconnectAttempts++;
        logger.warn(
            `MQTT service: Client reconnecting... (attempt ${this.connectionState.reconnectAttempts})`,
        );
        this.connectionState.isConnecting = true;
    };

    /**
     * Subscribe to configured topics
     */
    private async subscribeToTopics(): Promise<void> {
        if (!this.client || !this.connectionState.isConnected) {
            logger.warn(
                "MQTT service: Cannot subscribe to topics: client not connected",
            );
            return;
        }

        try {
            logger.info(
                `MQTT service: Subscribing to topics: ${this.config.topics.join(", ")}`,
            );

            await new Promise<void>((resolve, reject) => {
                this.client!.subscribe(
                    this.config.topics,
                    { qos: this.config.qos },
                    (error: Error | null) => {
                        if (error) {
                            logger.error(
                                "MQTT service: Failed to subscribe to topics:",
                                error,
                            );
                            reject(error);
                        } else {
                            logger.info(
                                "MQTT service: Successfully subscribed to all topics",
                            );
                            resolve();
                        }
                    },
                );
            });
        } catch (error) {
            logger.error("MQTT service: Error subscribing to topics:", error);
            throw error;
        }
    }

    /**
     * Process incoming MQTT message
     */
    private async processMessage(
        topic: string,
        message: Buffer,
        receivedTime: number,
    ): Promise<void> {
        try {
            // Decode message
            const messageString = message.toString();
            logger.debug(
                `MQTT service: Processing message from topic ${topic}: ${messageString}`,
            );

            // Validate against input schema
            const isInputValid =
                this.schemaManager.validateInputMessage(messageString);
            if (!isInputValid) {
                logger.error(
                    `MQTT service: Input message validation failed for topic ${topic}`,
                );
                return;
            }

            // Transform message (add processing metadata)
            const processedMessage = {
                sensor_id: topic,
                message: messageString,
                received_at: receivedTime,
            };

            // Validate against output schema
            const isOutputValid =
                this.schemaManager.validateOutputMessage(processedMessage);
            if (!isOutputValid) {
                logger.error(
                    `MQTT service: Output message validation failed for topic ${topic}`,
                );
                return;
            }

            // Send to Kafka
            await this.kafkaProducer.sendMessage(
                JSON.stringify(processedMessage),
            );
            logger.debug(
                `MQTT service: Successfully processed and sent message from topic ${topic} to Kafka`,
            );
        } catch (error) {
            logger.error(
                `MQTT service: Error processing message from topic ${topic}:`,
                message,
                error,
            );
        }
    }

    /**
     * Disconnect from MQTT broker
     */
    async disconnect(): Promise<void> {
        if (this.client) {
            try {
                logger.debug("MQTT service: Disconnecting from MQTT broker...");
                await new Promise<void>((resolve) => {
                    this.client!.end(false, {}, () => {
                        logger.warn(
                            "MQTT service: Client disconnected gracefully",
                        );
                        resolve();
                    });
                });
            } catch (error) {
                logger.error(
                    "MQTT service: Error during MQTT disconnect:",
                    error,
                );
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
        return (
            this.connectionState.isConnected && this.client?.connected === true
        );
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

export { MQTTService, type ConnectionState };
