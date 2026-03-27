import { EventEmitter } from "node:events";
import Pusher, { Channel} from "pusher-js";
import { logger } from "@spine/shared";
import { gunzipSync } from "node:zlib";
import { Buffer } from "node:buffer";
import type { EmpathicBuildingConfig, DecodedEvent, ChannelSubscription, TokenData } from "./types";

class EmpathicBuildingService extends EventEmitter {
    private readonly config: EmpathicBuildingConfig;
    private pusher?: Pusher;
    private subscriptions: Map<string, ChannelSubscription> = new Map();
    private reconnectAttempts = 0;
    private reconnectTimer?: NodeJS.Timeout;
    private tokenRefreshTimer?: NodeJS.Timeout;
    private isConnected = false;
    private tokenData?: TokenData;

    constructor(config: EmpathicBuildingConfig) {
        super();
        this.config = config;
        
        // Validate authentication configuration
        if (!config.bearerToken && (!config.username || !config.password)) {
            throw new Error(
                "Either bearerToken or both username and password must be provided",
            );
        }
    }

    /**
     * Authenticate with Empathic Building API
     */
    private async authenticate(): Promise<string> {
        // If bearerToken is provided, use it directly
        if (this.config.bearerToken) {
            logger.debug("Using provided bearer token");
            return this.config.bearerToken;
        }

        // If we have valid token data and it's not expired, use it
        if (this.tokenData && Date.now() < this.tokenData.expiresAt - 60000) {
            // Refresh 1 minute before expiration
            logger.debug("Using existing valid token");
            return this.tokenData.accessToken;
        }

        // If we have a refresh token, try to refresh
        if (this.tokenData?.refreshToken) {
            try {
                logger.info("Refreshing access token...");
                const newToken = await this.refreshToken(this.tokenData.refreshToken);
                return newToken;
            } catch (error) {
                logger.warn("Token refresh failed, attempting new login:", error);
                // Fall through to login
            }
        }

        // Perform new login
        if (!this.config.username || !this.config.password) {
            throw new Error("Username and password required for authentication");
        }

        logger.info("Authenticating with Empathic Building API...");
        const formData = new URLSearchParams();
        formData.append("email", this.config.username);
        formData.append("password", this.config.password);

        const response = await fetch(`${this.config.baseUrl}/v1/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: formData.toString(),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
                `Authentication failed: ${response.status} - ${errorText}`,
            );
        }

        const data = await response.json();

        const expiresIn = (data.expires_in) * 1000; // Convert to milliseconds

        this.tokenData = {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: Date.now() + expiresIn,
            tokenType: data.token_type,
        };

        logger.info(
            `Authentication successful. Token expires in ${data.expires_in} seconds`,
        );

        // Schedule token refresh before expiration
        this.scheduleTokenRefresh(expiresIn - 60000); // Refresh 1 minute before expiration

        return this.tokenData.accessToken;
    }

    /**
     * Refresh access token using refresh token
     */
    private async refreshToken(refreshToken: string): Promise<string> {
        const formData = new URLSearchParams();
        formData.append("refresh_token", refreshToken);

        const response = await fetch(`${this.config.baseUrl}/v1/token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: formData.toString(),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
                `Token refresh failed: ${response.status} - ${errorText}`,
            );
        }

        const data = await response.json();
        const expiresIn = (data.expires_in || 3600) * 1000;

        this.tokenData = {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: Date.now() + expiresIn,
            tokenType: data.token_type || "Bearer",
        };

        logger.info("Token refreshed successfully");

        // Schedule next refresh
        this.scheduleTokenRefresh(expiresIn - 60000);

        return this.tokenData.accessToken;
    }

    /**
     * Schedule automatic token refresh
     */
    private scheduleTokenRefresh(delayMs: number): void {
        // Clear existing timer
        if (this.tokenRefreshTimer) {
            clearTimeout(this.tokenRefreshTimer);
        }

        // Only schedule if we have credentials to refresh
        if (!this.config.username || !this.config.password) {
            return; // Can't refresh without credentials
        }

        if (delayMs <= 0) {
            delayMs = 1000; // Minimum 1 second
        }

        logger.debug(`Scheduling token refresh in ${delayMs}ms`);

        this.tokenRefreshTimer = setTimeout(async () => {
            try {
                if (this.tokenData?.refreshToken) {
                    await this.refreshToken(this.tokenData.refreshToken);
                    // Reconnect with new token since Pusher-js doesn't support dynamic auth updates
                    if (this.pusher && this.isConnected) {
                        logger.info("Token refreshed. Reconnecting with new token...");
                        await this.disconnect();
                        await this.connect();
                    }
                }
            } catch (error) {
                logger.error("Automatic token refresh failed:", error);
                this.emit("tokenRefreshError", error);
                // Try to reconnect with fresh login
                if (this.isConnected) {
                    logger.info("Attempting to reconnect after token refresh failure...");
                    try {
                        await this.disconnect();
                        await this.connect();
                    } catch (reconnectError) {
                        logger.error("Reconnection after token refresh failed:", reconnectError);
                    }
                }
            }
        }, delayMs);
    }

    /**
     * Get current bearer token (authenticating if necessary)
     */
    private async getBearerToken(): Promise<string> {
        return await this.authenticate();
    }

    /**
     * Connect to Pusher and subscribe to configured channels
     */
    async connect(): Promise<void> {
        if (this.pusher && this.isConnected) {
            logger.warn("Empathic Building service already connected");
            return;
        }

        try {
            logger.info("Connecting to Empathic Building Pusher service...");

            // Authenticate first if needed
            const bearerToken = await this.getBearerToken();

            // Initialize Pusher client
            this.pusher = new Pusher(this.config.pusherKey, {
                cluster: this.config.pusherCluster,
                authEndpoint: `${this.config.baseUrl}/v1/pusher/auth`,
                auth: {
                    headers: {
                        authorization: `Bearer ${bearerToken}`,
                    },
                },
                enabledTransports: ["ws", "wss"],
            });

            // Set up connection event handlers
            this.pusher.connection.bind("connected", () => {
                logger.info("Connected to Empathic Building Pusher");
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.emit("connected");
            });

            this.pusher.connection.bind("disconnected", () => {
                logger.warn("Disconnected from Empathic Building Pusher");
                this.isConnected = false;
                this.emit("disconnected");
                this.handleReconnect();
            });

            this.pusher.connection.bind("error", (error: Error) => {
                logger.error("Pusher connection error:", error);
                this.emit("error", error);
            });

            this.pusher.connection.bind("state_change", (states: {
                previous: string;
                current: string;
            }) => {
                logger.debug(
                    `Pusher state changed: ${states.previous} -> ${states.current}`,
                );
            });

            // Subscribe to channels
            await this.subscribeToChannels();

            // Connect Pusher
            this.pusher.connect();
        } catch (error) {
            logger.error("Failed to connect to Empathic Building:", error);
            this.emit("error", error);
            throw error;
        }
    }

    /**
     * Subscribe to all configured channels
     */
    private async subscribeToChannels(): Promise<void> {
        const channels: string[] = [];

        // Organization channels
        if (this.config.organizationIds) {
            for (const orgId of this.config.organizationIds) {
                const channelName = `private-organization-${orgId}`;
                channels.push(channelName);
            }
        }

        // Location channels
        if (this.config.locationIds) {
            for (const locationId of this.config.locationIds) {
                const channelName = `private-location-${locationId}`;
                channels.push(channelName);
            }
        }

        // Notifications channel
        if (this.config.subscribeToNotifications) {
            channels.push("notifications");
        }

        if (channels.length === 0) {
            throw new Error(
                "No channels configured for subscription. Configure at least one of: organizationIds, locationIds, or subscribeToNotifications",
            );
        }

        logger.info(`Subscribing to ${channels.length} channel(s): ${channels.join(", ")}`);

        for (const channelName of channels) {
            await this.subscribeToChannel(channelName);
        }
    }

    /**
     * Subscribe to a specific channel
     */
    private async subscribeToChannel(channelName: string): Promise<void> {
        if (!this.pusher) {
            throw new Error("Pusher client not initialized. Call connect() first.");
        }

        try {
            logger.debug(`Subscribing to channel: ${channelName}`);

            const channel = this.pusher.subscribe(channelName);

            // Wait for subscription to be confirmed
            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error(`Timeout subscribing to channel: ${channelName}`));
                }, 10000);

                channel.bind("pusher:subscription_succeeded", () => {
                    clearTimeout(timeout);
                    logger.info(`Successfully subscribed to channel: ${channelName}`);
                    resolve();
                });

                channel.bind("pusher:subscription_error", (error: unknown) => {
                    clearTimeout(timeout);
                    logger.error(
                        `Failed to subscribe to channel ${channelName}:`,
                        error,
                    );
                    // Check if it's an auth error and we have credentials to re-authenticate
                    if (
                        typeof error === "object" &&
                        error !== null &&
                        "status" in error &&
                        (error.status === 401 || error.status === 403) &&
                        this.config.username &&
                        this.config.password
                    ) {
                        logger.warn(
                            "Authentication error detected. Will attempt to re-authenticate and reconnect.",
                        );
                        // Clear token data to force re-authentication
                        this.tokenData = undefined;
                    }
                    reject(error);
                });
            });

            // Set up event handlers for this channel
            this.setupChannelEventHandlers(channel, channelName);

            // Store subscription
            this.subscriptions.set(channelName, {
                channel,
                channelName,
                subscribed: true,
            });

            this.emit("subscribed", { channel: channelName });
        } catch (error) {
            logger.error(
                `Error subscribing to channel ${channelName}:`,
                error,
            );
            throw error;
        }
    }

    /**
     * Set up event handlers for a channel
     */
    private setupChannelEventHandlers(
        channel: Channel,
        channelName: string,
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
                "user-deleted",
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
                "sensor-deleted",
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
                "notification-deleted",
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
        encodedData: string,
    ): void {
        try {
            // Decode the event: base64 -> gzip decompress -> JSON parse
            const decoded = this.decodeEvent(encodedData);

            const event: DecodedEvent = {
                eventType,
                channel,
                data: decoded,
                timestamp: Date.now(),
            };

            logger.debug(`Received event: ${eventType} on ${channel}`);

            // Emit the decoded event
            this.emit("event", event);
            this.emit(eventType, event);
        } catch (error) {
            logger.error(
                `Error handling event ${eventType} from ${channel}:`,
                error,
            );
            this.emit("error", error);
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
            throw new Error(`Failed to decode event data: ${error}`);
        }
    }

    /**
     * Handle reconnection logic
     */
    private handleReconnect(): void {
        if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
            logger.error(
                `Max reconnection attempts (${this.config.maxReconnectAttempts}) reached. Stopping reconnection.`,
            );
            this.emit("maxReconnectAttemptsReached");
            return;
        }

        this.reconnectAttempts++;
        const delay = this.config.reconnectDelayMs * this.reconnectAttempts;

        logger.info(
            `Attempting to reconnect (${this.reconnectAttempts}/${this.config.maxReconnectAttempts}) in ${delay}ms...`,
        );

        this.reconnectTimer = setTimeout(() => {
            this.connect().catch((error) => {
                logger.error("Reconnection attempt failed:", error);
            });
        }, delay);
    }

    /**
     * Disconnect from Pusher
     */
    async disconnect(): Promise<void> {
        logger.info("Disconnecting from Empathic Building Pusher...");

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = undefined;
        }

        if (this.tokenRefreshTimer) {
            clearTimeout(this.tokenRefreshTimer);
            this.tokenRefreshTimer = undefined;
        }

        // Unsubscribe from all channels
        for (const [channelName, subscription] of this.subscriptions) {
            try {
                subscription.channel.unbind_all();
                this.pusher?.unsubscribe(channelName);
                logger.debug(`Unsubscribed from channel: ${channelName}`);
            } catch (error) {
                logger.error(
                    `Error unsubscribing from ${channelName}:`,
                    error,
                );
            }
        }

        this.subscriptions.clear();

        // Disconnect Pusher
        if (this.pusher) {
            this.pusher.disconnect();
            this.pusher = undefined;
        }

        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.emit("disconnected");
        logger.info("Disconnected from Empathic Building Pusher");
    }

    /**
     * Get connection status
     */
    getStatus(): {
        connected: boolean;
        subscriptions: number;
        reconnectAttempts: number;
    } {
        return {
            connected: this.isConnected,
            subscriptions: this.subscriptions.size,
            reconnectAttempts: this.reconnectAttempts,
        };
    }

    /**
     * Get list of subscribed channels
     */
    getSubscribedChannels(): string[] {
        return Array.from(this.subscriptions.keys());
    }

    /**
     * Get token status (if using username/password authentication)
     */
    getTokenStatus(): {
        hasToken: boolean;
        expiresAt?: number;
        expiresIn?: number; // seconds until expiration
        isExpired: boolean;
    } {
        if (!this.tokenData) {
            return {
                hasToken: false,
                isExpired: true,
            };
        }

        const now = Date.now();
        const expiresIn = Math.max(0, Math.floor((this.tokenData.expiresAt - now) / 1000));

        return {
            hasToken: true,
            expiresAt: this.tokenData.expiresAt,
            expiresIn,
            isExpired: expiresIn === 0,
        };
    }
}

export { EmpathicBuildingService };

