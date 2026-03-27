import type { Channel } from "pusher-js";

/**
 * Configuration for Empathic Building API connection
 */
interface EmpathicBuildingConfig {
    baseUrl: string;
    pusherKey: string;
    pusherCluster: string;
    // Authentication: either provide username/password OR bearerToken
    username?: string;
    password?: string;
    bearerToken?: string; // Optional if username/password provided
    organizationIds?: string[];
    locationIds?: string[];
    subscribeToNotifications?: boolean;
    reconnectDelayMs: number;
    maxReconnectAttempts: number;
}

interface DecodedEvent {
    eventType: string;
    channel: string;
    data: unknown;
    timestamp: number;
}

interface ChannelSubscription {
    channel: Channel;
    channelName: string;
    subscribed: boolean;
}

interface TokenData {
    accessToken: string;
    refreshToken: string;
    expiresAt: number; // Timestamp in milliseconds
    tokenType: string;
}

export type {
    EmpathicBuildingConfig,
    DecodedEvent,
    ChannelSubscription,
    TokenData,
}