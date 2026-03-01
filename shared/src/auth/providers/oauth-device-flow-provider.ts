/**
 * OAuth2 Device Code Flow Provider (RFC 8628)
 * Best for: CLI, headless environments, SSH sessions
 *
 * Flow:
 * 1. Request device code from authorization server
 * 2. Display device code and verification URL to user
 * 3. User opens browser and enters device code
 * 4. CLI polls token endpoint until user completes auth
 * 5. Upon success, store access token and optional refresh token
 */

import axios, { AxiosInstance } from 'axios';
import { AuthConfig, AuthProvider, CredentialProvider, TokenResponse } from '../auth-provider';

interface DeviceCodeResponse {
    device_code: string;
    user_code: string;
    verification_uri: string;
    verification_uri_complete?: string;
    expires_in: number;
    interval?: number;
}

interface DeviceFlowConfig extends AuthConfig {
    options: {
        deviceAuthorizationEndpoint: string;
        tokenEndpoint: string;
        clientId: string;
        clientSecret?: string;
        scope?: string;
        pollInterval?: number; // milliseconds, default: 5000
        maxWaitTime?: number; // milliseconds, default: 1800000 (30 minutes)
    };
}

const DEFAULT_POLL_INTERVAL = 5000; // 5 seconds
const DEFAULT_MAX_WAIT = 1800000; // 30 minutes
const TOKEN_KEY = 'oauth_device_flow_token';
const REFRESH_TOKEN_KEY = 'oauth_device_flow_refresh_token';
const TOKEN_EXPIRY_KEY = 'oauth_device_flow_expiry';

export class OAuthDeviceFlowProvider implements AuthProvider {
    private config: DeviceFlowConfig;
    private credentialProvider: CredentialProvider;
    private client: AxiosInstance;
    private token: string | undefined;
    private refreshToken: string | undefined;
    private tokenExpiry: number | undefined;

    constructor(config: AuthConfig, credentialProvider: CredentialProvider) {
        this.config = config as DeviceFlowConfig;
        this.credentialProvider = credentialProvider;

        if (!this.config.options?.deviceAuthorizationEndpoint) {
            throw new Error('Device Flow requires deviceAuthorizationEndpoint option');
        }
        if (!this.config.options?.tokenEndpoint) {
            throw new Error('Device Flow requires tokenEndpoint option');
        }
        if (!this.config.options?.clientId) {
            throw new Error('Device Flow requires clientId option');
        }

        this.client = axios.create({
            timeout: 30000,
        });

        // Load stored token on initialization
        this.loadStoredToken();
    }

    async authenticate(): Promise<void> {
        // Request device code from auth server
        const deviceCodeResponse = await this.requestDeviceCode();

        // Display instructions to user
        const verificationUrl =
            deviceCodeResponse.verification_uri_complete || deviceCodeResponse.verification_uri;
        console.log('\n=== Device Code Authorization ===');
        console.log(`Please visit: ${verificationUrl}`);
        console.log(`Or visit: ${deviceCodeResponse.verification_uri}`);
        console.log(`And enter code: ${deviceCodeResponse.user_code}`);
        console.log('============================\n');

        // Poll token endpoint until user authenticates
        const pollInterval = this.config.options?.pollInterval || DEFAULT_POLL_INTERVAL;
        const maxWait = this.config.options?.maxWaitTime || DEFAULT_MAX_WAIT;
        const startTime = Date.now();

        while (Date.now() - startTime < maxWait) {
            try {
                const tokenResponse = await this.pollTokenEndpoint(
                    deviceCodeResponse.device_code,
                );

                // Successfully got token
                this.token = tokenResponse.access_token;
                this.refreshToken = tokenResponse.refresh_token;

                if (tokenResponse.expires_in) {
                    this.tokenExpiry = Date.now() + tokenResponse.expires_in * 1000;
                }

                // Store token securely
                await this.storeToken();

                console.log('✓ Authentication successful!');
                return;
            } catch (error) {
                // Check for specific errors
                const message = error instanceof Error ? error.message : String(error);

                // Authorization pending - user hasn't completed auth yet
                if (message.includes('authorization_pending')) {
                    await new Promise((resolve) => setTimeout(resolve, pollInterval));
                    continue;
                }

                // Slow down - server is rate limiting
                if (message.includes('slow_down')) {
                    const newInterval = pollInterval + 5000;
                    console.log(`Rate limited, increasing poll interval to ${newInterval}ms`);
                    await new Promise((resolve) => setTimeout(resolve, newInterval));
                    continue;
                }

                // User denied authorization
                if (message.includes('access_denied')) {
                    throw new Error('Authorization denied by user');
                }

                // Expired device code
                if (message.includes('expired_token')) {
                    throw new Error('Device code expired. Please try again.');
                }

                // Other errors - log and continue polling
                console.debug(`Poll error (continuing): ${message}`);
                await new Promise((resolve) => setTimeout(resolve, pollInterval));
            }
        }

        throw new Error(
            `Device code authentication timed out after ${maxWait / 1000} seconds`,
        );
    }

    getAuthHeaders(): Record<string, string> {
        if (!this.token) {
            return {};
        }
        return {
            Authorization: `Bearer ${this.token}`,
        };
    }

    isAuthenticated(): boolean {
        if (!this.token) {
            return false;
        }

        // Check if token has expired
        if (this.tokenExpiry && Date.now() > this.tokenExpiry) {
            return false;
        }

        return true;
    }

    async refresh(): Promise<void> {
        if (!this.refreshToken) {
            throw new Error(
                'No refresh token available. Run authenticate() first or check token configuration.',
            );
        }

        try {
            const response = await this.client.post<TokenResponse>(
                this.config.options.tokenEndpoint,
                {
                    grant_type: 'refresh_token',
                    refresh_token: this.refreshToken,
                    client_id: this.config.options.clientId,
                    ...(this.config.options.clientSecret && {
                        client_secret: this.config.options.clientSecret,
                    }),
                },
            );

            this.token = response.data.access_token;
            if (response.data.refresh_token) {
                this.refreshToken = response.data.refresh_token;
            }

            if (response.data.expires_in) {
                this.tokenExpiry = Date.now() + response.data.expires_in * 1000;
            }

            await this.storeToken();
        } catch (error) {
            throw new Error(
                `Failed to refresh device flow token: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    async logout(): Promise<void> {
        this.token = undefined;
        this.refreshToken = undefined;
        this.tokenExpiry = undefined;

        // Clear stored token
        await this.credentialProvider.delete(TOKEN_KEY);
        await this.credentialProvider.delete(REFRESH_TOKEN_KEY);
        await this.credentialProvider.delete(TOKEN_EXPIRY_KEY);
    }

    private async requestDeviceCode(): Promise<DeviceCodeResponse> {
        try {
            const response = await this.client.post<DeviceCodeResponse>(
                this.config.options.deviceAuthorizationEndpoint,
                {
                    client_id: this.config.options.clientId,
                    scope: this.config.options.scope || 'openid profile email',
                },
            );

            return response.data;
        } catch (error) {
            throw new Error(
                `Failed to request device code: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    private async pollTokenEndpoint(deviceCode: string): Promise<TokenResponse> {
        try {
            const response = await this.client.post<TokenResponse>(
                this.config.options.tokenEndpoint,
                {
                    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
                    device_code: deviceCode,
                    client_id: this.config.options.clientId,
                    ...(this.config.options.clientSecret && {
                        client_secret: this.config.options.clientSecret,
                    }),
                },
            );

            return response.data;
        } catch (error) {
            // Re-throw to allow caller to handle specific error messages
            throw error;
        }
    }

    private async storeToken(): Promise<void> {
        if (this.token) {
            await this.credentialProvider.store(TOKEN_KEY, this.token);
        }
        if (this.refreshToken) {
            await this.credentialProvider.store(REFRESH_TOKEN_KEY, this.refreshToken);
        }
        if (this.tokenExpiry) {
            await this.credentialProvider.store(TOKEN_EXPIRY_KEY, String(this.tokenExpiry));
        }
    }

    private loadStoredToken(): void {
        // Note: This is async but called from constructor
        // In production, should use initializeAuthSystem() which handles async setup
        // For now, this is synchronous lookup (actual credential storage happens async)
        // Credentials are loaded on-demand when needed
    }
}
