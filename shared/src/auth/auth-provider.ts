/**
 * Core authentication abstractions for CALM Hub client authentication.
 * Supports plugin-based authentication providers (OAuth, API keys, custom SSO, etc.)
 * and pluggable credential storage (files, vaults, VSCode SecretStorage, etc.)
 */

/**
 * OAuth2 token response from authorization server
 */
export interface TokenResponse {
    /** OAuth2 access token */
    access_token: string;
    /** Optional refresh token for token renewal */
    refresh_token?: string;
    /** Token expiration time in seconds */
    expires_in?: number;
    /** Token type (typically "Bearer") */
    token_type?: string;
    /** Additional OAuth fields (scope, id_token, etc.) */
    [key: string]: unknown;
}

/**
 * Credential storage abstraction - allows pluggable storage mechanisms
 * (files, OS keyring, enterprise vaults, VSCode SecretStorage, etc.)
 */
export interface CredentialProvider {
    /**
     * Store a credential securely
     * @param key - Credential key
     * @param value - Credential value
     */
    store(key: string, value: string): Promise<void>;

    /**
     * Retrieve a stored credential
     * @param key - Credential key
     * @returns Credential value or undefined if not found
     */
    retrieve(key: string): Promise<string | undefined>;

    /**
     * Delete a specific credential
     * @param key - Credential key
     */
    delete(key: string): Promise<void>;

    /**
     * Clear all stored credentials
     */
    clear(): Promise<void>;
}

/**
 * Authentication provider - handles obtaining and managing tokens
 * Implementations support Device Flow, Authorization Code Flow, API keys, certificates, etc.
 */
export interface AuthProvider {
    /**
     * Initiate authentication flow
     * For Device Flow: displays device code to user
     * For Authorization Code: opens browser with auth URL
     * For Bearer Token: retrieves token from config/store
     */
    authenticate(): Promise<void>;

    /**
     * Get headers to add to HTTP requests
     * Returns { Authorization: "Bearer <token>" } or empty object if not authenticated
     */
    getAuthHeaders(): Record<string, string>;

    /**
     * Check if authentication is valid and not expired
     */
    isAuthenticated(): boolean;

    /**
     * Refresh authentication token if expired
     * Throws error if refresh not supported or fails
     */
    refresh(): Promise<void>;

    /**
     * Logout and clear credentials
     */
    logout(): Promise<void>;
}

/**
 * Authentication configuration
 */
export interface AuthConfig {
    /** Name of authentication provider to use (e.g., "oauth-device-flow", "oauth-authcode-flow", "bearer-token") */
    provider: string;

    /** Provider-specific configuration options */
    options?: Record<string, unknown>;

    /** Credential storage provider name (defaults to "file" for CLI, "vscode" for extension) */
    credentialStorage?: string;
}

/**
 * Registry for authentication providers - allows registering custom implementations
 */
export interface AuthProviderRegistry {
    /**
     * Register an authentication provider factory
     * @param name - Provider name (e.g., "oauth-device-flow")
     * @param factory - Factory function that creates provider instances
     */
    register(
        name: string,
        factory: (
            config: AuthConfig,
            credentialProvider: CredentialProvider,
        ) => AuthProvider,
    ): void;

    /**
     * Unregister an authentication provider
     * @param name - Provider name
     */
    unregister(name: string): void;

    /**
     * Get a registered authentication provider factory
     * @param name - Provider name
     * @returns Provider factory or undefined if not registered
     */
    get(
        name: string,
    ): ((
        config: AuthConfig,
        credentialProvider: CredentialProvider,
    ) => AuthProvider) | undefined;

    /**
     * List all registered provider names
     */
    list(): string[];
}

/**
 * Registry for credential providers - allows registering custom storage implementations
 */
export interface CredentialProviderRegistry {
    /**
     * Register a credential provider factory
     * @param name - Provider name (e.g., "file", "memory", "vault")
     * @param factory - Factory function that creates credential provider instances
     */
    register(name: string, factory: () => CredentialProvider): void;

    /**
     * Unregister a credential provider
     * @param name - Provider name
     */
    unregister(name: string): void;

    /**
     * Get a registered credential provider factory
     * @param name - Provider name
     * @returns Credential provider factory or undefined if not registered
     */
    get(name: string): (() => CredentialProvider) | undefined;

    /**
     * List all registered provider names
     */
    list(): string[];
}
