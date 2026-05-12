import { EventEmitter } from "node:events";
import Pusher from "pusher-js";
import type { Channel } from "pusher-js";
import { gunzipSync } from "node:zlib";
import { Buffer } from "node:buffer";
import { logger } from "@spine/shared";
import type {
    EBPusherConfig,
    ChannelSubscription,
    DecodedEvent,
    AuthProvider
} from "../utils/eb_types";

class EBPusherService extends EventEmitter {
    private config: EBPusherConfig;
    private authProvider: AuthProvider;
    private pusher?: Pusher;
    private isConnected = false;
    private subscriptions: Map<string, ChannelSubscription> = new Map();
    private reconnectAttempts = 0;
    private reconnectTimer?: NodeJS.Timeout;
    private isShuttingDown = false;

    constructor(config: EBPusherConfig, authProvider: AuthProvider) {
        super();
        this.config = config;
        this.authProvider = authProvider;
    }

    /**
     * Subscribe to all configured channels
     */
    private async subscribeToChannels(): Promise<void> {
        const channels: string[] = [];

        // Organization channels
        for (const orgId of this.config.organizationIds) {
            const channelName = `private-organization-${orgId}`;
            channels.push(channelName);
        }

        // Location channels
        for (const locationId of this.config.locationIds) {
            const channelName = `private-location-${locationId}`;
            channels.push(channelName);
        }

        if (channels.length === 0) {
            throw new Error(
                "No channels configured for subscription. Configure at least one of: organizationIds, locationIds, or subscribeToNotifications"
            );
        }

        logger.debug(
            `Subscribing to ${channels.length} channel(s): ${channels.join(", ")}`
        );

        for (const channelName of channels) {
            await this.subscribeToChannel(channelName);
        }
    }

    /**
     * Subscribe to a specific channel
     */
    private async subscribeToChannel(channelName: string): Promise<void> {
        if (!this.pusher) {
            throw new Error(
                "Pusher client not initialized. Call connect() first."
            );
        }

        const channel = this.pusher.subscribe(channelName);

        // Wait for subscription to be confirmed
        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(
                    new Error(`Timeout subscribing to channel: ${channelName}`)
                );
            }, 10000);

            channel.bind("pusher:subscription_succeeded", () => {
                clearTimeout(timeout);
                logger.info(
                    `Successfully subscribed to channel: ${channelName}`
                );
                resolve();
            });

            channel.bind("pusher:subscription_error", (error: unknown) => {
                clearTimeout(timeout);
                this.emit("subscriptionError", {
                    channelName,
                    error
                });
                reject(error);
            });
        });

        // Set up event handlers for this channel
        this.setupChannelEventHandlers(channel, channelName);

        // Store subscription
        this.subscriptions.set(channelName, {
            channel,
            channelName,
            subscribed: true
        });

        this.emit("subscribed", { channel: channelName });
    }

    /**
     * Set up event handlers for a channel
     */
    private setupChannelEventHandlers(
        channel: Channel,
        channelName: string
    ): void {
        // Organization channel events
        if (channelName.startsWith("private-organization-")) {
            const orgEvents = [
                "organization-modified",
                "organization-deleted",
                "location-created",
                "location-modified",
                "location-deleted",
                "user-created",
                "user-modified",
                "user-deleted"
            ];

            for (const eventName of orgEvents) {
                channel.bind(eventName, (data: string) => {
                    this.handleEvent(eventName, channelName, data);
                });
            }
        }

        // Location channel events
        if (channelName.startsWith("private-location-")) {
            const locationEvents = [
                "asset-created",
                "asset-modified",
                "asset-deleted",
                "gateway-created",
                "gateway-modified",
                "gateway-deleted",
                "sensor-created",
                "sensor-modified",
                "sensor-deleted"
            ];

            for (const eventName of locationEvents) {
                channel.bind(eventName, (data: string) => {
                    this.handleEvent(eventName, channelName, data);
                });
            }
        }

        // Notifications channel events
        if (channelName === "notifications") {
            const notificationEvents = [
                "notification-created",
                "notification-modified",
                "notification-deleted"
            ];

            for (const eventName of notificationEvents) {
                channel.bind(eventName, (data: string) => {
                    this.handleEvent(eventName, channelName, data);
                });
            }
        }
    }

    /**
     * Handle incoming event from Pusher
     */
    private handleEvent(
        eventType: string,
        channel: string,
        encodedData: string
    ): void {
        try {
            // Decode the event: base64 -> gzip decompress -> JSON parse
            const decoded = this.decodeEvent(encodedData);

            const event: DecodedEvent = {
                eventType,
                channel,
                data: decoded,
                timestamp: Date.now()
            };

            // Emit the decoded event
            this.emit("event", event);
            this.emit(eventType, event);
        } catch (error) {
            this.emit("eventError", {
                eventType,
                channel,
                error
            });
        }
    }

    /**
     * Decode Empathic Building event data
     * Format: base64 encoded -> gzip compressed -> JSON array
     */
    private decodeEvent(encodedData: string): unknown {
        try {
            // Step 1: Decode base64 to binary
            const binaryData = Buffer.from(encodedData, "base64");

            // Step 2: Decompress gzip
            const decompressed = gunzipSync(binaryData);

            // Step 3: Parse JSON
            const jsonData = JSON.parse(decompressed.toString("utf-8"));

            return jsonData;
        } catch (error) {
            logger.error("Error decoding event data:", error);
            throw new Error(`Failed to decode event data: ${error}`, {
                cause: error
            });
        }
    }

    /**
     * Connect to Pusher and subscribe to configured channels
     */
    async connect(): Promise<void> {
        if (this.pusher && this.isConnected) {
            logger.warn("Empathic Building pusher already connected");
            return;
        }

        try {
            logger.debug("Connecting to Empathic Building Pusher service...");

            const token = await this.authProvider.getToken();

            // Initialize Pusher client
            this.pusher = new Pusher(this.config.pusherKey, {
                cluster: this.config.pusherCluster,
                authEndpoint: `${this.config.baseUrl}/v1/pusher/auth`,
                auth: {
                    headers: {
                        authorization: `Bearer ${token}`
                    }
                },
                enabledTransports: ["ws", "wss"]
            });

            // Set up connection event handlers
            this.pusher.connection.bind("connected", () => {
                this.isConnected = true;
                this.emit("connected");
            });

            this.pusher.connection.bind("disconnected", () => {
                this.isConnected = false;
                this.emit("disconnected");
                this.emit("connectionLost");
                this.scheduleReconnect("disconnected");
            });

            this.pusher.connection.bind("error", (error: Error) => {
                this.emit("connectionError", error);
                this.scheduleReconnect("connection_error", error);
            });

            this.pusher.connection.bind(
                "state_change",
                (states: { previous: string; current: string }) => {
                    logger.debug(
                        `Pusher state changed: ${states.previous} -> ${states.current}`
                    );
                }
            );

            // Subscribe to channels
            await this.subscribeToChannels();

            // Connect Pusher
            this.pusher.connect();

            // Clear any previous reconnect attempts
            this.clearReconnect();
        } catch (error) {
            this.emit("connectionError", error);
            // schedule reconnect unless shutting down
            this.scheduleReconnect("connect_failed", error);
            throw error;
        }
    }

    private clearReconnect(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = undefined;
        }
        this.reconnectAttempts = 0;
    }

    private scheduleReconnect(reason: string, error?: unknown): void {
        if (this.isShuttingDown) return;
        if (this.reconnectTimer) return;

        if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
            this.emit("maxReconnectAttemptsReached", {
                reason,
                maxReconnectAttempts: this.config.maxReconnectAttempts,
                error
            });
            return;
        }

        this.reconnectAttempts++;
        const delayMs = this.config.reconnectDelayMs * this.reconnectAttempts;
        logger.warn("EB Pusher: scheduling reconnect", {
            reason,
            attempt: this.reconnectAttempts,
            delayMs,
            error
        });

        this.reconnectTimer = setTimeout(async () => {
            this.reconnectTimer = undefined;
            try {
                await this.disconnect();
            } catch (e) {
                logger.debug("Error during disconnect before reconnect", e);
            }
            try {
                await this.connect();
            } catch (e) {
                this.scheduleReconnect("reconnect_failed", e);
            }
        }, delayMs);
    }

    /**
     * Disconnect from Pusher
     */
    async disconnect(): Promise<void> {
        logger.debug("Disconnecting from Empathic Building Pusher...");

        if (!this.pusher) {
            logger.warn("EB Pusher service not connected");
            return;
        }

        // Unsubscribe from all channels
        for (const [channelName, subscription] of this.subscriptions) {
            try {
                subscription.channel.unbind_all();
                this.pusher.unsubscribe(channelName);
                logger.debug(`Unsubscribed from channel: ${channelName}`);
            } catch (error) {
                logger.error(`Error unsubscribing from ${channelName}:`, error);
            }
        }

        this.subscriptions.clear();

        // Disconnect Pusher
        this.pusher.disconnect();
        this.pusher = undefined;

        this.isConnected = false;
        logger.debug("Disconnected from Empathic Building Pusher");
    }
}

export { EBPusherService };
