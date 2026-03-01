/**
 * Bearer Token Provider
 * Best for: CI/CD, API keys, pre-obtained tokens, certificate-based authentication
 *
 * Supports:
 * - Static bearer token from config
 * - Token retrieved from credential store
 * - Environment variable substitution
 */

import { AuthConfig, AuthProvider, CredentialProvider } from '../auth-provider';

interface BearerTokenConfig extends AuthConfig {
    options?: {
        token?: string; // Static token or env var reference
        tokenStoreKey?: string; // Key to retrieve token from credential provider
        refreshable?: boolean; // If true, child class can implement refresh
    };
}

const DEFAULT_TOKEN_KEY = 'bearer-token';

export class BearerTokenProvider implements AuthProvider {
    protected config: BearerTokenConfig;
    protected credentialProvider: CredentialProvider;
    private token: string | undefined;

    constructor(config: AuthConfig, credentialProvider: CredentialProvider) {
        this.config = config as BearerTokenConfig;
        this.credentialProvider = credentialProvider;

        // Resolve token from config or environment
        const configToken = this.config.options?.token;
        if (configToken) {
            // Support environment variable substitution: ${ENV_VAR_NAME}
            if (configToken.startsWith('${') && configToken.endsWith('}')) {
                const envVarName = configToken.slice(2, -1);
                const envValue = process.env[envVarName];
                if (!envValue) {
                    throw new Error(
                        `Bearer token references environment variable ${envVarName}, but it is not set`,
                    );
                }
                this.token = envValue;
            } else {
                this.token = configToken;
            }
        }
    }

    async authenticate(): Promise<void> {
        // Try to load token from credential store if not in config
        if (!this.token) {
            const storeKey = this.config.options?.tokenStoreKey || DEFAULT_TOKEN_KEY;
            const storedToken = await this.credentialProvider.retrieve(storeKey);

            if (!storedToken) {
                throw new Error(
                    `No bearer token configured. Set token in config, environment variable, or credential store with key "${storeKey}"`,
                );
            }

            this.token = storedToken;
        }

        console.log('✓ Bearer token authentication loaded');
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
        return !!this.token;
    }

    async refresh(): Promise<void> {
        // Bearer tokens don't refresh by default
        // Child implementations can override for specific token types
        if (this.config.options?.refreshable === true) {
            throw new Error(
                'Bearer token refresh not implemented. Override refresh() in subclass for specific token type.',
            );
        }
    }

    async logout(): Promise<void> {
        this.token = undefined;

        // Clear from credential store if it was stored
        const storeKey = this.config.options?.tokenStoreKey || DEFAULT_TOKEN_KEY;
        await this.credentialProvider.delete(storeKey);
    }
}

/**
 * Retrievable Bearer Token Provider
 * For tokens that need to be stored and retrieved from credential store
 * Perfect for API keys and temporary tokens that are obtained externally
 */
export class RetrievableBearerTokenProvider extends BearerTokenProvider {
    private storeKey: string;

    constructor(config: AuthConfig, credentialProvider: CredentialProvider) {
        super(config, credentialProvider);
        this.storeKey = (config.options?.tokenStoreKey as string) || DEFAULT_TOKEN_KEY;
    }

    /**
     * Store a new bearer token
     * Can be called by CLI commands to save API keys
     */
    async setToken(token: string): Promise<void> {
        await this.credentialProvider.store(this.storeKey, token);
    }

    /**
     * Retrieve the stored bearer token
     */
    async getStoredToken(): Promise<string | undefined> {
        return this.credentialProvider.retrieve(this.storeKey);
    }
}
