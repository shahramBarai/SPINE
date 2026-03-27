type SupportedMethod = "GET" | "POST";
type AuthType = "none" | "basic" | "bearer" | "apikey" | "oauth2";
type ApiKeyLocation = "header" | "query";
type PaginationMode = "none" | "page" | "cursor" | "link";

interface RestAuthConfig {
    type: AuthType;
    username?: string;
    password?: string;
    bearerToken?: string;
    apiKey?: string;
    apiKeyHeader?: string;
    apiKeyQueryParam?: string;
    apiKeyLocation?: ApiKeyLocation;
    customHeaders?: Record<string, string>;
    oauth?: {
        tokenUrl: string;
        clientId: string;
        clientSecret: string;
        scope?: string;
        audience?: string;
        grantType: string;
        refreshMarginSeconds: number;
    };
}

interface RestEndpointConfig {
    path: string;
    method: SupportedMethod;
    bodyTemplate?: unknown;
}

interface RestPaginationConfig {
    mode: PaginationMode;
    pageParam?: string;
    pageSizeParam?: string;
    pageSize?: number;
    maxPages?: number;
    cursorParam?: string;
    nextCursorField?: string;
    nextLinkField?: string;
}

interface RestPollingConfig {
    pollIntervalMs: number;
    timeoutMs: number;
    retryAttempts: number;
    retryDelayMs: number;
}

interface RestApiConfig {
    baseUrl: string;
    endpoints: RestEndpointConfig[];
    poller: RestPollingConfig;
    auth: RestAuthConfig;
    pagination: RestPaginationConfig;
    customHeaders: Record<string, string>;
    defaultMethod: SupportedMethod;
}

export type {
    RestApiConfig,
    RestEndpointConfig,
    RestPaginationConfig,
    RestPollingConfig,
    RestAuthConfig,
};