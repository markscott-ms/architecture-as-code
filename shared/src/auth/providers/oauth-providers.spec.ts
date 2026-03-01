/**
 * Tests for OAuth authentication providers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OAuthDeviceFlowProvider } from './oauth-device-flow-provider';
import { OAuthAuthCodeFlowProvider } from './oauth-authcode-flow-provider';
import { BearerTokenProvider, RetrievableBearerTokenProvider } from './bearer-token-provider';
import { type CredentialProvider, type AuthConfig } from '../auth-provider';
import { MemoryCredentialProvider } from '../credentials/memory-credential-provider';

describe('OAuthDeviceFlowProvider', () => {
    let credProvider: CredentialProvider;
    let provider: OAuthDeviceFlowProvider;

    beforeEach(() => {
        credProvider = new MemoryCredentialProvider();
        vi.clearAllMocks();
    });

    it('should require deviceAuthorizationEndpoint option', () => {
        const config: AuthConfig = {
            provider: 'oauth-device-flow',
            options: {
                tokenEndpoint: 'https://auth.example.com/token',
                clientId: 'test-client',
            },
        };

        expect(() => new OAuthDeviceFlowProvider(config, credProvider)).toThrow(
            'deviceAuthorizationEndpoint',
        );
    });

    it('should require tokenEndpoint option', () => {
        const config: AuthConfig = {
            provider: 'oauth-device-flow',
            options: {
                deviceAuthorizationEndpoint: 'https://auth.example.com/device',
                clientId: 'test-client',
            },
        };

        expect(() => new OAuthDeviceFlowProvider(config, credProvider)).toThrow('tokenEndpoint');
    });

    it('should require clientId option', () => {
        const config: AuthConfig = {
            provider: 'oauth-device-flow',
            options: {
                deviceAuthorizationEndpoint: 'https://auth.example.com/device',
                tokenEndpoint: 'https://auth.example.com/token',
            },
        };

        expect(() => new OAuthDeviceFlowProvider(config, credProvider)).toThrow('clientId');
    });

    it('should return no headers when not authenticated', () => {
        const config: AuthConfig = {
            provider: 'oauth-device-flow',
            options: {
                deviceAuthorizationEndpoint: 'https://auth.example.com/device',
                tokenEndpoint: 'https://auth.example.com/token',
                clientId: 'test-client',
            },
        };

        provider = new OAuthDeviceFlowProvider(config, credProvider);
        const headers = provider.getAuthHeaders();

        expect(headers).toEqual({});
    });

    it('should report not authenticated without token', () => {
        const config: AuthConfig = {
            provider: 'oauth-device-flow',
            options: {
                deviceAuthorizationEndpoint: 'https://auth.example.com/device',
                tokenEndpoint: 'https://auth.example.com/token',
                clientId: 'test-client',
            },
        };

        provider = new OAuthDeviceFlowProvider(config, credProvider);
        expect(provider.isAuthenticated()).toBe(false);
    });

    it('should logout and clear credentials', async () => {
        const config: AuthConfig = {
            provider: 'oauth-device-flow',
            options: {
                deviceAuthorizationEndpoint: 'https://auth.example.com/device',
                tokenEndpoint: 'https://auth.example.com/token',
                clientId: 'test-client',
            },
        };

        provider = new OAuthDeviceFlowProvider(config, credProvider);

        // Simulate having a token by manually checking logout clears things
        await provider.logout();

        expect(provider.isAuthenticated()).toBe(false);
        expect(provider.getAuthHeaders()).toEqual({});
    });
});

describe('OAuthAuthCodeFlowProvider', () => {
    let credProvider: CredentialProvider;
    let provider: OAuthAuthCodeFlowProvider;

    beforeEach(() => {
        credProvider = new MemoryCredentialProvider();
        vi.clearAllMocks();
    });

    it('should require authorizationEndpoint option', () => {
        const config: AuthConfig = {
            provider: 'oauth-authcode-flow',
            options: {
                tokenEndpoint: 'https://auth.example.com/token',
                clientId: 'test-client',
            },
        };

        expect(() => new OAuthAuthCodeFlowProvider(config, credProvider)).toThrow(
            'authorizationEndpoint',
        );
    });

    it('should require tokenEndpoint option', () => {
        const config: AuthConfig = {
            provider: 'oauth-authcode-flow',
            options: {
                authorizationEndpoint: 'https://auth.example.com/authorize',
                clientId: 'test-client',
            },
        };

        expect(() => new OAuthAuthCodeFlowProvider(config, credProvider)).toThrow('tokenEndpoint');
    });

    it('should require clientId option', () => {
        const config: AuthConfig = {
            provider: 'oauth-authcode-flow',
            options: {
                authorizationEndpoint: 'https://auth.example.com/authorize',
                tokenEndpoint: 'https://auth.example.com/token',
            },
        };

        expect(() => new OAuthAuthCodeFlowProvider(config, credProvider)).toThrow('clientId');
    });

    it('should return no headers when not authenticated', () => {
        const config: AuthConfig = {
            provider: 'oauth-authcode-flow',
            options: {
                authorizationEndpoint: 'https://auth.example.com/authorize',
                tokenEndpoint: 'https://auth.example.com/token',
                clientId: 'test-client',
            },
        };

        provider = new OAuthAuthCodeFlowProvider(config, credProvider);
        const headers = provider.getAuthHeaders();

        expect(headers).toEqual({});
    });

    it('should report not authenticated without token', () => {
        const config: AuthConfig = {
            provider: 'oauth-authcode-flow',
            options: {
                authorizationEndpoint: 'https://auth.example.com/authorize',
                tokenEndpoint: 'https://auth.example.com/token',
                clientId: 'test-client',
            },
        };

        provider = new OAuthAuthCodeFlowProvider(config, credProvider);
        expect(provider.isAuthenticated()).toBe(false);
    });

    it('should logout and clear credentials', async () => {
        const config: AuthConfig = {
            provider: 'oauth-authcode-flow',
            options: {
                authorizationEndpoint: 'https://auth.example.com/authorize',
                tokenEndpoint: 'https://auth.example.com/token',
                clientId: 'test-client',
            },
        };

        provider = new OAuthAuthCodeFlowProvider(config, credProvider);
        await provider.logout();

        expect(provider.isAuthenticated()).toBe(false);
        expect(provider.getAuthHeaders()).toEqual({});
    });
});

describe('BearerTokenProvider', () => {
    let credProvider: CredentialProvider;
    let provider: BearerTokenProvider;

    beforeEach(() => {
        credProvider = new MemoryCredentialProvider();
        vi.clearAllMocks();
    });

    it('should accept static bearer token in config', async () => {
        const config: AuthConfig = {
            provider: 'bearer-token',
            options: {
                token: 'static-token-123',
            },
        };

        provider = new BearerTokenProvider(config, credProvider);
        await provider.authenticate();

        expect(provider.isAuthenticated()).toBe(true);
        expect(provider.getAuthHeaders()).toEqual({
            Authorization: 'Bearer static-token-123',
        });
    });

    it('should support environment variable substitution', async () => {
        process.env.TEST_AUTH_TOKEN = 'env-token-456';

        const config: AuthConfig = {
            provider: 'bearer-token',
            options: {
                token: '${TEST_AUTH_TOKEN}',
            },
        };

        provider = new BearerTokenProvider(config, credProvider);
        await provider.authenticate();

        expect(provider.isAuthenticated()).toBe(true);
        expect(provider.getAuthHeaders()).toEqual({
            Authorization: 'Bearer env-token-456',
        });

        delete process.env.TEST_AUTH_TOKEN;
    });

    it('should throw error for missing environment variable', () => {
        const config: AuthConfig = {
            provider: 'bearer-token',
            options: {
                token: '${MISSING_TOKEN_VAR}',
            },
        };

        expect(() => new BearerTokenProvider(config, credProvider)).toThrow('MISSING_TOKEN_VAR');
    });

    it('should throw error if no token configured on authenticate', async () => {
        const config: AuthConfig = {
            provider: 'bearer-token',
            options: {},
        };

        provider = new BearerTokenProvider(config, credProvider);

        await expect(provider.authenticate()).rejects.toThrow('No bearer token configured');
    });

    it('should not support refresh by default', async () => {
        const config: AuthConfig = {
            provider: 'bearer-token',
            options: {
                token: 'static-token',
            },
        };

        provider = new BearerTokenProvider(config, credProvider);

        // Should not throw or should be a no-op for non-refreshable provider
        await expect(provider.refresh()).resolves.not.toThrow();
    });

    it('should logout and clear token', async () => {
        const config: AuthConfig = {
            provider: 'bearer-token',
            options: {
                token: 'static-token-123',
            },
        };

        provider = new BearerTokenProvider(config, credProvider);
        await provider.authenticate();

        expect(provider.isAuthenticated()).toBe(true);

        await provider.logout();

        expect(provider.isAuthenticated()).toBe(false);
        expect(provider.getAuthHeaders()).toEqual({});
    });
});

describe('RetrievableBearerTokenProvider', () => {
    let credProvider: CredentialProvider;
    let provider: RetrievableBearerTokenProvider;

    beforeEach(() => {
        credProvider = new MemoryCredentialProvider();
        vi.clearAllMocks();
    });

    it('should store and retrieve bearer token', async () => {
        const config: AuthConfig = {
            provider: 'bearer-token',
            options: {
                tokenStoreKey: 'api-key',
            },
        };

        provider = new RetrievableBearerTokenProvider(config, credProvider);

        // Set token
        await provider.setToken('stored-token-789');

        // Retrieve token
        const token = await provider.getStoredToken();
        expect(token).toBe('stored-token-789');
    });

    it('should authenticate with stored token', async () => {
        const config: AuthConfig = {
            provider: 'bearer-token',
            options: {
                tokenStoreKey: 'api-key',
            },
        };

        provider = new RetrievableBearerTokenProvider(config, credProvider);

        // Store a token
        await provider.setToken('stored-token-456');

        // Authenticate (should load from store)
        await provider.authenticate();

        expect(provider.isAuthenticated()).toBe(true);
        expect(provider.getAuthHeaders()).toEqual({
            Authorization: 'Bearer stored-token-456',
        });
    });

    it('should use default store key', async () => {
        const config: AuthConfig = {
            provider: 'bearer-token',
        };

        provider = new RetrievableBearerTokenProvider(config, credProvider);
        await provider.setToken('default-key-token');

        const token = await provider.getStoredToken();
        expect(token).toBe('default-key-token');
    });

    it('should clear token on logout', async () => {
        const config: AuthConfig = {
            provider: 'bearer-token',
            options: {
                tokenStoreKey: 'api-key',
            },
        };

        provider = new RetrievableBearerTokenProvider(config, credProvider);

        await provider.setToken('token-to-clear');
        expect(await provider.getStoredToken()).toBe('token-to-clear');

        await provider.logout();

        expect(await provider.getStoredToken()).toBeUndefined();
    });
});

describe('Bearer Token with Credential Store', () => {
    it('should load token from credential store during authenticate', async () => {
        const credProvider = new MemoryCredentialProvider();

        const config: AuthConfig = {
            provider: 'bearer-token',
            options: {
                tokenStoreKey: 'my-api-key',
            },
        };

        // Pre-store a token
        await credProvider.store('my-api-key', 'previously-stored-token');

        const provider = new BearerTokenProvider(config, credProvider);
        await provider.authenticate();

        expect(provider.isAuthenticated()).toBe(true);
        expect(provider.getAuthHeaders()).toEqual({
            Authorization: 'Bearer previously-stored-token',
        });
    });
});
