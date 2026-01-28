import mqtt, { MqttClient, IClientOptions } from "mqtt";
import { getMQTTConfig, type MQTTConfig } from "../utils/config";
import { logger } from "@spine/shared";

interface ConnectionState {
    isConnected: boolean;
    isConnecting: boolean;
    reconnectAttempts: number;
    lastConnectedAt?: Date;
    lastDisconnectedAt?: Date;
}

class MQTTService {
    private config: MQTTConfig | null;
    private client: MqttClient | null = null;
    private connectionState: ConnectionState = {
        isConnected: false,
        isConnecting: false,
        reconnectAttempts: 0,
    };

    constructor() {
        this.config = getMQTTConfig();
    }

    /**
     * Check if MQTT gateway is enabled
     */
    isEnabled(): boolean {
        return this.config !== null;
    }

    /**
     * Connect to MQTT broker
     */
    async connect(): Promise<boolean> {
        if (!this.config) {
            logger.info("MQTT gateway: MQTT is disabled, skipping connection");
            return false;
        }

        if (this.connectionState.isConnected || this.connectionState.isConnecting) {
            logger.warn("MQTT gateway: Already connected or connecting");
            return this.connectionState.isConnected;
        }

        this.connectionState.isConnecting = true;

        try {
            const options: IClientOptions = {
                clientId: this.config.clientId,
                clean: true,
                keepalive: this.config.keepalive,
                reconnectPeriod: this.config.reconnectPeriod,
                connectTimeout: this.config.connectTimeout,
                username: this.config.username,
                password: this.config.password,
            };

            this.client = mqtt.connect(this.config.brokerUrl, options);

            return new Promise((resolve) => {
                if (!this.client) {
                    resolve(false);
                    return;
                }

                this.client.on("connect", () => {
                    logger.info("MQTT gateway: Connected to MQTT broker");
                    this.connectionState.isConnected = true;
                    this.connectionState.isConnecting = false;
                    this.connectionState.reconnectAttempts = 0;
                    this.connectionState.lastConnectedAt = new Date();
                    resolve(true);
                });

                this.client.on("error", (error) => {
                    logger.error("MQTT gateway: Connection error", error);
                    this.connectionState.isConnected = false;
                    this.connectionState.isConnecting = false;
                    this.connectionState.lastDisconnectedAt = new Date();
                    resolve(false);
                });

                this.client.on("close", () => {
                    logger.warn("MQTT gateway: Connection closed");
                    this.connectionState.isConnected = false;
                    this.connectionState.lastDisconnectedAt = new Date();
                });

                this.client.on("reconnect", () => {
                    this.connectionState.reconnectAttempts++;
                    logger.info(
                        `MQTT gateway: Reconnecting (attempt ${this.connectionState.reconnectAttempts})`,
                    );
                });

                this.client.on("offline", () => {
                    logger.warn("MQTT gateway: Client went offline");
                    this.connectionState.isConnected = false;
                    this.connectionState.lastDisconnectedAt = new Date();
                });
            });
        } catch (error) {
            logger.error("MQTT gateway: Failed to connect", error);
            this.connectionState.isConnecting = false;
            this.connectionState.isConnected = false;
            return false;
        }
    }

    /**
     * Publish sensor data to MQTT broker
     */
    async publish(topic: string, message: string): Promise<void> {
        if (!this.config) {
            // MQTT is disabled, silently skip
            return;
        }

        if (!this.client || !this.connectionState.isConnected) {
            logger.warn(
                "MQTT gateway: Cannot publish, not connected to MQTT broker",
            );
            return;
        }

        try {
            await new Promise<void>((resolve, reject) => {
                if (!this.client || !this.config) {
                    reject(new Error("MQTT client not available"));
                    return;
                }

                this.client.publish(
                    topic,
                    message,
                    {
                        qos: this.config.qos,
                        retain: this.config.retain,
                    },
                    (error) => {
                        if (error) {
                            logger.error(
                                `MQTT gateway: Failed to publish to topic ${topic}`,
                                error,
                            );
                            reject(error);
                        } else {
                            logger.debug(
                                `MQTT gateway: Published message to topic ${topic}`,
                            );
                            resolve();
                        }
                    },
                );
            });
        } catch (error) {
            logger.error(
                `MQTT gateway: Error publishing message for topic ${topic} message: ${message}`,
                error,
            );
        }
    }

    /**
     * Disconnect from MQTT broker
     */
    async disconnect(): Promise<void> {
        if (!this.client) {
            return;
        }

        try {
            await new Promise<void>((resolve) => {
                if (!this.client) {
                    resolve();
                    return;
                }

                this.client.end(false, {}, () => {
                    logger.info("MQTT gateway: Disconnected from MQTT broker");
                    this.connectionState.isConnected = false;
                    this.connectionState.lastDisconnectedAt = new Date();
                    this.client = null;
                    resolve();
                });
            });
        } catch (error) {
            logger.error("MQTT gateway: Error disconnecting", error);
        }
    }

    /**
     * Health check for MQTT gateway
     */
    async healthCheck(): Promise<{
        status: string;
        timestamp: string;
        connectionState: ConnectionState;
        error?: string;
    }> {
        return {
            status: this.connectionState.isConnected ? "connected" : "disconnected",
            timestamp: new Date().toISOString(),
            connectionState: { ...this.connectionState },
            error: this.connectionState.isConnected
                ? undefined
                : "Not connected to MQTT broker",
        };
    }
}

export { MQTTService };
