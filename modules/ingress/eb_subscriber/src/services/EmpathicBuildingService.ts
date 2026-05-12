import { logger } from "@spine/shared";
import type { EBApiConfig, TokenData } from "../utils/eb_types";

class EmpathicBuildingService {
    private readonly config: EBApiConfig;
    private tokenRefreshTimer?: NodeJS.Timeout;
    private tokenData?: TokenData;

    constructor(config: EBApiConfig) {
        this.config = config;
    }

    /**
     * Authenticate with Empathic Building API using username/password and obtain access token
     *
     * @returns TokenData including access token, refresh token, and expiration
     */
    private async login(): Promise<TokenData> {
        logger.debug("Authenticating using credentials...");
        const username = this.config.username;
        const password = this.config.password;

        const formData = new URLSearchParams();
        formData.append("email", username);
        formData.append("password", password);

        const response = await fetch(`${this.config.baseUrl}/v1/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: formData.toString()
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
                `Authentication failed: ${response.status} - ${errorText}`
            );
        }

        const data = await response.json();

        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: Date.now() + data.expires_in * 1000,
            tokenType: data.token_type
        };
    }

    /**
     * Refresh access token using refresh token
     *
     * @return Updated TokenData with new access token and expiration or null if refresh failed
     */
    private async refreshToken(
        refreshToken: string
    ): Promise<TokenData | undefined> {
        try {
            const formData = new URLSearchParams();
            formData.append("refresh_token", refreshToken);

            const response = await fetch(`${this.config.baseUrl}/v1/token`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: formData.toString()
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(
                    `Token refresh failed: ${response.status} - ${errorText}`
                );
            }

            const data = await response.json();
            const expiresIn = data.expires_in * 1000;

            this.tokenData = {
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                expiresAt: Date.now() + expiresIn,
                tokenType: data.token_type || "Bearer"
            };

            return this.tokenData;
        } catch (error) {
            logger.error("Error refreshing token:", error);
            return undefined;
        }
    }

    /**
     * Schedule automatic token refresh
     */
    private scheduleTokenRefresh(delayMs: number): void {
        // Clear existing timer
        if (this.tokenRefreshTimer) {
            clearTimeout(this.tokenRefreshTimer);
            this.tokenRefreshTimer = undefined;
        }

        if (delayMs <= 0) {
            delayMs = 1000; // Minimum 1 second
        }

        logger.debug(`Scheduling token refresh in ${delayMs}ms`);

        this.tokenRefreshTimer = setTimeout(async () => {
            await this.authenticate();
        }, delayMs);
    }

    /**
     * Authenticate with Empathic Building API
     */
    async authenticate(): Promise<void> {
        // If we have valid token data
        if (this.tokenData) {
            // And if token is still valid, return it (refresh if expiring within 1 minute)
            if (Date.now() < this.tokenData.expiresAt - 60000) {
                logger.debug("Using existing valid token");
                return;
            } else {
                // Else try to refresh the token
                logger.debug("Refreshing access token...");
                this.tokenData = await this.refreshToken(
                    this.tokenData.refreshToken
                );
            }
        }

        // If we don't have valid token data from refresh, perform login
        if (!this.tokenData) {
            this.tokenData = await this.login();
        }

        // Schedule token refresh before expiration
        const expiresIn = this.tokenData.expiresAt - Date.now();
        this.scheduleTokenRefresh(expiresIn - 60000); // Refresh 1 minute before expiration
        logger.debug(
            `Authentication successful. Token expires in ${expiresIn} seconds`
        );
    }

    /**
     * Get current access token for API requests
     *
     * @returns Access token string or undefined if not authenticated
     */
    getAccessToken(): string | undefined {
        return this.tokenData?.accessToken;
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
                isExpired: true
            };
        }

        const now = Date.now();
        const expiresIn = Math.max(
            0,
            Math.floor((this.tokenData.expiresAt - now) / 1000)
        );

        return {
            hasToken: true,
            expiresAt: this.tokenData.expiresAt,
            expiresIn,
            isExpired: expiresIn === 0
        };
    }
}

export { EmpathicBuildingService };
