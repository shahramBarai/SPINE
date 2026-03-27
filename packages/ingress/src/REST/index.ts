import { EventEmitter } from "node:events";
import { logger } from "@spine/shared";
import type {
    RestApiConfig,
    RestEndpointConfig,
    RestPaginationConfig,
} from "./types";

interface PollingResult {
    endpoint: RestEndpointConfig;
    page: number;
    payload: unknown;
    status: number;
    headers: Record<string, string>;
    url: string;
}

interface RequestContext {
    page?: number;
    cursor?: string;
    nextLink?: string;
}

class RESTService extends EventEmitter {
    private readonly config: RestApiConfig;
    private pollingTimer?: NodeJS.Timeout;
    private oauthToken:
        | {
              value: string;
              expiresAt: number;
          }
        | undefined;

    constructor(config: RestApiConfig) {
        super();
        this.config = config;
    }

    startPolling(handler?: (result: PollingResult) => Promise<void> | void) {
        if (this.pollingTimer) {
            logger.warn("RESTService polling is already running");
            return;
        }

        const executePoll = async () => {
            try {
                await this.pollOnce(handler);
            } catch (error) {
                logger.error("RESTService polling failed", error);
                this.emit("error", error);
            }
        };

        // Kick off immediately
        void executePoll();
        this.pollingTimer = setInterval(
            () => void executePoll(),
            this.config.poller.pollIntervalMs,
        );
    }

    stopPolling() {
        if (this.pollingTimer) {
            clearInterval(this.pollingTimer);
            this.pollingTimer = undefined;
            logger.info("RESTService polling stopped");
        }
    }

    async pollOnce(
        handler?: (result: PollingResult) => Promise<void> | void,
    ) {
        for (const endpoint of this.config.endpoints) {
            await this.pollEndpoint(endpoint, handler);
        }
    }

    private async pollEndpoint(
        endpoint: RestEndpointConfig,
        handler?: (result: PollingResult) => Promise<void> | void,
    ) {
        const pagination = this.config.pagination;
        let page = 1;
        let cursor: string | undefined;
        let nextLink: string | undefined;

        do {
            try {
                const result = await this.executeRequest(endpoint, {
                    page,
                    cursor,
                    nextLink,
                });

                const pollingResult: PollingResult = {
                    endpoint,
                    page,
                    payload: result.payload,
                    status: result.status,
                    headers: result.headers,
                    url: result.url,
                };

                this.emit("data", pollingResult);
                if (handler) {
                    await handler(pollingResult);
                }

                ({ cursor, nextLink } = this.extractPaginationState(
                    result.payload,
                    pagination,
                ));

                if (
                    !this.hasNextPage(
                        result.payload,
                        pagination,
                        page,
                        cursor,
                        nextLink,
                    )
                ) {
                    break;
                }

                page += 1;
            } catch (error) {
                this.emit("error", error);
                logger.error(
                    `RESTService failed to poll endpoint ${endpoint.path}`,
                    error,
                );
                break;
            }
        } while (true);
    }

    private async executeRequest(
        endpoint: RestEndpointConfig,
        context: RequestContext,
    ) {
        const { url, headers, body } = await this.createRequestInit(
            endpoint,
            context,
        );

        const response = await this.executeWithRetry(async () => {
            const controller = new AbortController();
            const timeout = setTimeout(
                () => controller.abort(),
                this.config.poller.timeoutMs,
            );
            try {
                const res = await fetch(url, {
                    method: endpoint.method,
                    headers,
                    body,
                    signal: controller.signal,
                });
                return res;
            } finally {
                clearTimeout(timeout);
            }
        });

        if (!response.ok) {
            const payload = await this.safeParseBody(response);
            throw new Error(
                `RESTService got ${response.status} from ${url}: ${JSON.stringify(
                    payload,
                )}`,
            );
        }

        return {
            payload: await this.safeParseBody(response),
            status: response.status,
            headers: this.headersToRecord(response.headers),
            url: response.url,
        };
    }

    private async createRequestInit(
        endpoint: RestEndpointConfig,
        context: RequestContext,
    ) {
        const url = this.buildUrl(endpoint.path, context.nextLink);
        const headers: Record<string, string> = {
            accept: "application/json",
            ...this.config.customHeaders,
            ...(this.config.auth.customHeaders ?? {}),
        };

        if (endpoint.method === "POST" && !headers["content-type"]) {
            headers["content-type"] = "application/json";
        }

        this.applyPaginationParams(url, context);
        await this.applyAuth(url, headers);

        const body =
            endpoint.method === "POST" && endpoint.bodyTemplate
                ? this.serializeBody(endpoint.bodyTemplate)
                : undefined;

        return { url, headers, body };
    }

    private buildUrl(path: string, absoluteOverride?: string) {
        if (absoluteOverride) {
            return new URL(absoluteOverride);
        }
        const isAbsolute = /^https?:\/\//u.test(path);
        return isAbsolute ? new URL(path) : new URL(path, this.config.baseUrl);
    }

    private applyPaginationParams(url: URL, context: RequestContext) {
        const { pagination } = this.config;
        if (pagination.mode === "page" && context.page) {
            url.searchParams.set(
                pagination.pageParam ?? "page",
                context.page.toString(),
            );
            if (pagination.pageSize && pagination.pageSizeParam) {
                url.searchParams.set(
                    pagination.pageSizeParam,
                    pagination.pageSize.toString(),
                );
            }
        }

        if (pagination.mode === "cursor" && context.cursor) {
            url.searchParams.set(
                pagination.cursorParam ?? "cursor",
                context.cursor,
            );
        }
    }

    private async applyAuth(url: URL, headers: Record<string, string>) {
        const auth = this.config.auth;
        switch (auth.type) {
            case "basic": {
                if (!auth.username || !auth.password) {
                    throw new Error("Basic auth requires username and password");
                }
                const encoded = Buffer.from(
                    `${auth.username}:${auth.password}`,
                ).toString("base64");
                headers.Authorization = `Basic ${encoded}`;
                break;
            }
            case "bearer": {
                if (!auth.bearerToken) {
                    throw new Error("Bearer auth requires a token");
                }
                headers.Authorization = `Bearer ${auth.bearerToken}`;
                break;
            }
            case "apikey": {
                if (!auth.apiKey) {
                    throw new Error("API key auth requires apiKey to be set");
                }
                if (auth.apiKeyLocation === "query") {
                    url.searchParams.set(
                        auth.apiKeyQueryParam || "api_key",
                        auth.apiKey,
                    );
                } else {
                    headers[auth.apiKeyHeader ?? "x-api-key"] = auth.apiKey;
                }
                break;
            }
            case "oauth2": {
                const token = await this.getOAuthToken();
                headers.Authorization = `Bearer ${token}`;
                break;
            }
            case "none":
            default:
                break;
        }
    }

    private async getOAuthToken() {
        if (this.oauthToken && this.oauthToken.expiresAt > Date.now()) {
            return this.oauthToken.value;
        }

        const oauth = this.config.auth.oauth;
        if (!oauth) {
            throw new Error("OAuth configuration missing");
        }

        const body = new URLSearchParams({
            grant_type: oauth.grantType,
            client_id: oauth.clientId,
            client_secret: oauth.clientSecret,
        });
        if (oauth.scope) {
            body.append("scope", oauth.scope);
        }
        if (oauth.audience) {
            body.append("audience", oauth.audience);
        }

        const response = await fetch(oauth.tokenUrl, {
            method: "POST",
            headers: {
                "content-type": "application/x-www-form-urlencoded",
            },
            body,
        });

        if (!response.ok) {
            throw new Error(
                `Failed to obtain OAuth token: ${response.status}`,
            );
        }

        const payload = (await response.json()) as {
            access_token: string;
            expires_in?: number;
        };
        const expiresInSeconds = payload.expires_in ?? 3600;
        const refreshMargin = oauth.refreshMarginSeconds ?? 60;
        this.oauthToken = {
            value: payload.access_token,
            expiresAt: Date.now() + (expiresInSeconds - refreshMargin) * 1000,
        };
        return this.oauthToken.value;
    }

    private serializeBody(template: unknown): string | undefined {
        if (typeof template === "string") {
            return template;
        }
        return JSON.stringify(template);
    }

    private async executeWithRetry<T>(
        fn: () => Promise<T>,
    ): Promise<T> {
        let attempt = 0;
        const { retryAttempts, retryDelayMs } = this.config.poller;
        const maxAttempts = Math.max(1, retryAttempts);

        while (true) {
            try {
                attempt += 1;
                return await fn();
            } catch (error) {
                if (attempt >= maxAttempts) {
                    throw error;
                }
                const delay = retryDelayMs * attempt;
                logger.warn(
                    `RESTService request failed (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms`,
                    error,
                );
                await this.delay(delay);
            }
        }
    }

    private async safeParseBody(response: globalThis.Response) {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
            return response.json().catch(() => ({}));
        }
        return response.text().catch(() => "");
    }

    private headersToRecord(headers: globalThis.Headers) {
        const record: Record<string, string> = {};
        headers.forEach((value, key) => {
            record[key] = value;
        });
        return record;
    }

    private extractPaginationState(
        payload: unknown,
        pagination: RestPaginationConfig,
    ) {
        if (pagination.mode === "cursor") {
            const cursor = this.resolveField(
                payload,
                pagination.nextCursorField,
            );
            return { cursor: cursor as string | undefined, nextLink: undefined };
        }
        if (pagination.mode === "link") {
            const link = this.resolveField(
                payload,
                pagination.nextLinkField,
            );
            return { cursor: undefined, nextLink: link as string | undefined };
        }
        return { cursor: undefined, nextLink: undefined };
    }

    private hasNextPage(
        payload: unknown,
        pagination: RestPaginationConfig,
        page: number,
        cursor?: string,
        link?: string,
    ) {
        if (pagination.mode === "page") {
            const hasMoreData =
                Array.isArray(payload) && payload.length > 0;
            const underMaxPages =
                !pagination.maxPages || page < pagination.maxPages;
            return hasMoreData && underMaxPages;
        }
        if (pagination.mode === "cursor") {
            return Boolean(cursor);
        }
        if (pagination.mode === "link") {
            return Boolean(link);
        }
        return false;
    }

    private resolveField(payload: unknown, path?: string) {
        if (!payload || !path) {
            return undefined;
        }
        return path.split(".").reduce<unknown>((acc, key) => {
            if (acc && typeof acc === "object" && key in acc) {
                return (acc as Record<string, unknown>)[key];
            }
            return undefined;
        }, payload);
    }

    private async delay(ms: number) {
        return new Promise<void>((resolve) => {
            setTimeout(resolve, ms);
        });
    }
}

export { RESTService, type PollingResult };
