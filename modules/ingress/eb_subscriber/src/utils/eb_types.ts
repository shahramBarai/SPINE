import type { Channel } from "pusher-js";

/**
 * Configuration for Empathic Building API connection
 */
interface EBApiConfig {
    baseUrl: string;
    // Authentication: either provide username/password OR bearerToken
    username: string;
    password: string;
}

/**
 * Configuration for Pusher connection to Empathic Building
 */
interface EBPusherConfig {
    baseUrl: string;
    pusherKey: string;
    pusherCluster: string;
    organizationIds: string[];
    locationIds: string[];
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

/**
 * Simple auth provider interface for obtaining bearer tokens.
 * Implementations should handle refreshing and caching tokens.
 */
interface AuthProvider {
    getToken(): Promise<string>;
}

export type {
    EBApiConfig,
    EBPusherConfig,
    DecodedEvent,
    ChannelSubscription,
    TokenData,
    AuthProvider
};
