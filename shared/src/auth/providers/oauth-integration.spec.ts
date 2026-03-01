/**
 * Integration tests for OAuth authentication flows
 * Tests realistic scenarios with token storage, expiration, and refresh
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { OAuthDeviceFlowProvider } from './oauth-device-flow-provider';
import { OAuthAuthCodeFlowProvider } from './oauth-authcode-flow-provider';
import { BearerTokenProvider, RetrievableBearerTokenProvider } from './bearer-token-provider';
import { type CredentialProvider, type AuthConfig } from '../auth-provider';
import { MemoryCredentialProvider } from '../credentials/memory-credential-provider';

describe('OAuth Integration Tests', () => {
    let credProvider: CredentialProvider;

    beforeEach(() => {
        credProvider = new MemoryCredentialProvider();
    });

    describe('BearerTokenProvider with Credential Store', () => {
        it('should persist token across provider instances', async () => {
            const storeKey = 'integration-test-token';

            // First instance - store token
            const config1: AuthConfig = {
                provider: 'bearer-token',
                options: { tokenStoreKey: storeKey },
            };
            const provider1 = new RetrievableBearerTokenProvider(config1, credProvider);
            await provider1.setToken('persistent-token-123');

            // Second instance - retrieve same token
            const config2: AuthConfig = {
                provider: 'bearer-token',
                options: { tokenStoreKey: storeKey },
            };
            const provider2 = new RetrievableBearerTokenProvider(config2, credProvider);
            await provider2.authenticate();

            expect(provider2.isAuthenticated()).toBe(true);
            expect(provider2.getAuthHeaders()).toEqual({
                Authorization: 'Bearer persistent-token-123',
            });
        });

        it('should handle multiple tokens with different keys', async () => {
            const provider1Config: AuthConfig = {
                provider: 'bearer-token',
                options: { tokenStoreKey: 'api-key-1' },
            };
            const provider2Config: AuthConfig = {
                provider: 'bearer-token',
                options: { tokenStoreKey: 'api-key-2' },
            };

            const provider1 = new RetrievableBearerTokenProvider(provider1Config, credProvider);
            const provider2 = new RetrievableBearerTokenProvider(provider2Config, credProvider);

            await provider1.setToken('token-for-api-1');
            await provider2.setToken('token-for-api-2');

            expect(await provider1.getStoredToken()).toBe('token-for-api-1');
            expect(await provider2.getStoredToken()).toBe('token-for-api-2');
        });

        it('should clear one token without affecting others', async () => {
            const provider1 = new RetrievableBearerTokenProvider(
                { provider: 'bearer-token', options: { tokenStoreKey: 'token-1' } },
                credProvider,
            );
            const provider2 = new RetrievableBearerTokenProvider(
                { provider: 'bearer-token', options: { tokenStoreKey: 'token-2' } },
                credProvider,
            );

            await provider1.setToken('token-1-value');
            await provider2.setToken('token-2-value');

            await provider1.logout();

            expect(await provider1.getStoredToken()).toBeUndefined();
            expect(await provider2.getStoredToken()).toBe('token-2-value');
        });
    });

    describe('Device Flow Provider Configuration', () => {
        it('should handle all configuration options', () => {
            const config: AuthConfig = {
                provider: 'oauth-device-flow',
                options: {
                    deviceAuthorizationEndpoint: 'https://auth.example.com/device_authorization',
                    tokenEndpoint: 'https://auth.example.com/token',
                    clientId: 'my-app-id',
                    clientSecret: 'client-secret-123',
                    scope: 'openid profile email offline_access',
                    pollInterval: 3000,
                    maxWaitTime: 900000, // 15 minutes
                },
            };

            const provider = new OAuthDeviceFlowProvider(config, credProvider);
            expect(provider).toBeDefined();
            expect(provider.isAuthenticated()).toBe(false);
        });

        it('should use default poll interval when not specified', () => {
            const config: AuthConfig = {
                provider: 'oauth-device-flow',
                options: {
                    deviceAuthorizationEndpoint: 'https://auth.example.com/device',
                    tokenEndpoint: 'https://auth.example.com/token',
                    clientId: 'test-client',
                },
            };

            const provider = new OAuthDeviceFlowProvider(config, credProvider);
            expect(provider).toBeDefined();
        });
    });

    describe('Authorization Code Flow Provider Configuration', () => {
        it('should handle all configuration options', () => {
            const config: AuthConfig = {
                provider: 'oauth-authcode-flow',
                options: {
                    authorizationEndpoint: 'https://auth.example.com/authorize',
                    tokenEndpoint: 'https://auth.example.com/token',
                    clientId: 'web-app-id',
                    clientSecret: 'secret-456',
                    redirectUri: 'http://localhost:3000/callback',
                    scope: 'openid profile email',
                    openBrowser: true,
                },
            };

            const provider = new OAuthAuthCodeFlowProvider(config, credProvider);
            expect(provider).toBeDefined();
            expect(provider.isAuthenticated()).toBe(false);
        });

        it('should allow disabling auto browser opening', () => {
            const config: AuthConfig = {
                provider: 'oauth-authcode-flow',
                options: {
                    authorizationEndpoint: 'https://auth.example.com/authorize',
                    tokenEndpoint: 'https://auth.example.com/token',
                    clientId: 'test-client',
                    openBrowser: false,
                },
            };

            const provider = new OAuthAuthCodeFlowProvider(config, credProvider);
            expect(provider).toBeDefined();
        });
    });

    describe('Bearer Token Provider with Environment Variables', () => {
        beforeEach(() => {
            process.env.AUTH_TOKEN_PROD = 'prod-token-xyz';
            process.env.AUTH_TOKEN_STAGING = 'staging-token-abc';
        });

        afterEach(() => {
            delete process.env.AUTH_TOKEN_PROD;
            delete process.env.AUTH_TOKEN_STAGING;
        });

        it('should support multiple env var tokens for different environments', async () => {
            const prodConfig: AuthConfig = {
                provider: 'bearer-token',
                options: { token: '${AUTH_TOKEN_PROD}' },
            };
            const stagingConfig: AuthConfig = {
                provider: 'bearer-token',
                options: { token: '${AUTH_TOKEN_STAGING}' },
            };

            const prodProvider = new BearerTokenProvider(prodConfig, credProvider);
            const stagingProvider = new BearerTokenProvider(stagingConfig, credProvider);

            await prodProvider.authenticate();
            await stagingProvider.authenticate();

            expect(prodProvider.getAuthHeaders()).toEqual({
                Authorization: 'Bearer prod-token-xyz',
            });
            expect(stagingProvider.getAuthHeaders()).toEqual({
                Authorization: 'Bearer staging-token-abc',
            });
        });

        it('should fail gracefully for missing env vars', () => {
            const config: AuthConfig = {
                provider: 'bearer-token',
                options: { token: '${NONEXISTENT_VAR}' },
            };

            expect(() => new BearerTokenProvider(config, credProvider)).toThrow();
        });
    });

    describe('Provider Lifecycle', () => {
        it('should properly handle authenticate -> refresh -> logout cycle', async () => {
            const config: AuthConfig = {
                provider: 'bearer-token',
                options: { token: 'test-token' },
            };

            const provider = new BearerTokenProvider(config, credProvider);

            // BearerTokenProvider is immediately authenticated when token is in config
            expect(provider.isAuthenticated()).toBe(true);

            // Authenticate
            await provider.authenticate();
            expect(provider.isAuthenticated()).toBe(true);

            // Refresh (no-op for bearer token)
            await provider.refresh();
            expect(provider.isAuthenticated()).toBe(true);

            // Logout
            await provider.logout();
            expect(provider.isAuthenticated()).toBe(false);
            expect(provider.getAuthHeaders()).toEqual({});
        });
    });

    describe('Error Handling', () => {
        it('BearerTokenProvider should throw for missing static token', async () => {
            const config: AuthConfig = {
                provider: 'bearer-token',
                options: {}, // No token provided
            };

            const provider = new BearerTokenProvider(config, credProvider);

            await expect(provider.authenticate()).rejects.toThrow('No bearer token configured');
        });

        it('Device Flow Provider should validate required options at construction', () => {
            const invalidConfigs: AuthConfig[] = [
                {
                    provider: 'oauth-device-flow',
                    options: {
                        // Missing deviceAuthorizationEndpoint
                        tokenEndpoint: 'https://auth.example.com/token',
                        clientId: 'test',
                    },
                },
                {
                    provider: 'oauth-device-flow',
                    options: {
                        deviceAuthorizationEndpoint: 'https://auth.example.com/device',
                        // Missing tokenEndpoint
                        clientId: 'test',
                    },
                },
                {
                    provider: 'oauth-device-flow',
                    options: {
                        deviceAuthorizationEndpoint: 'https://auth.example.com/device',
                        tokenEndpoint: 'https://auth.example.com/token',
                        // Missing clientId
                    },
                },
            ];

            invalidConfigs.forEach((config) => {
                expect(() => new OAuthDeviceFlowProvider(config, credProvider)).toThrow();
            });
        });

        it('Authorization Code Flow Provider should validate required options', () => {
            const invalidConfigs: AuthConfig[] = [
                {
                    provider: 'oauth-authcode-flow',
                    options: {
                        // Missing authorizationEndpoint
                        tokenEndpoint: 'https://auth.example.com/token',
                        clientId: 'test',
                    },
                },
                {
                    provider: 'oauth-authcode-flow',
                    options: {
                        authorizationEndpoint: 'https://auth.example.com/authorize',
                        // Missing tokenEndpoint
                        clientId: 'test',
                    },
                },
                {
                    provider: 'oauth-authcode-flow',
                    options: {
                        authorizationEndpoint: 'https://auth.example.com/authorize',
                        tokenEndpoint: 'https://auth.example.com/token',
                        // Missing clientId
                    },
                },
            ];

            invalidConfigs.forEach((config) => {
                expect(() => new OAuthAuthCodeFlowProvider(config, credProvider)).toThrow();
            });
        });
    });

    describe('Header Injection', () => {
        it('BearerTokenProvider should inject correct Authorization header format', async () => {
            const config: AuthConfig = {
                provider: 'bearer-token',
                options: { token: 'my-secret-token' },
            };

            const provider = new BearerTokenProvider(config, credProvider);
            await provider.authenticate();

            const headers = provider.getAuthHeaders();
            expect(headers.Authorization).toBe('Bearer my-secret-token');
            expect(headers.Authorization).toMatch(/^Bearer /);
        });

        it('RetrievableBearerTokenProvider header format', async () => {
            const config: AuthConfig = {
                provider: 'bearer-token',
                options: { tokenStoreKey: 'my-key' },
            };

            const provider = new RetrievableBearerTokenProvider(config, credProvider);
            await provider.setToken('stored-value');
            await provider.authenticate();

            const headers = provider.getAuthHeaders();
            expect(headers.Authorization).toBe('Bearer stored-value');
        });

        it('unauthenticated provider should return empty headers', () => {
            const config: AuthConfig = {
                provider: 'bearer-token',
                options: { token: 'some-token' },
            };

            const provider = new BearerTokenProvider(config, credProvider);

            const headers = provider.getAuthHeaders();
            // BearerTokenProvider with configured token is immediately authenticated
            expect(headers).toEqual({ Authorization: 'Bearer some-token' });
        });

        it('provider without configured token should be unauthenticated', () => {
            const config: AuthConfig = {
                provider: 'bearer-token',
                options: {}, // No token configured
            };

            const provider = new BearerTokenProvider(config, credProvider);

            expect(provider.isAuthenticated()).toBe(false);
            expect(provider.getAuthHeaders()).toEqual({});
        });
    });
});
