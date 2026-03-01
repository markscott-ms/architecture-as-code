import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleAuthLogin, handleAuthLogout, handleAuthStatus, handleAuthRefresh } from './auth';

// Mock dependencies
vi.mock('../cli-config', () => ({
    loadCliConfig: vi.fn(),
    loadAuthProvider: vi.fn(),
    loadCredentialProvider: vi.fn(),
}));

vi.mock('@finos/calm-shared', () => ({
    initLogger: vi.fn(() => ({
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    })),
    createAuthProvider: vi.fn(),
}));

import { loadCliConfig, loadAuthProvider, loadCredentialProvider } from '../cli-config';
import { createAuthProvider } from '@finos/calm-shared';

describe('CLI Auth Commands', () => {
    let consoleLogSpy: any;
    let consoleErrorSpy: any;
    let processExitSpy: any;

    beforeEach(() => {
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
        processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { });
    });

    afterEach(() => {
        vi.clearAllMocks();
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        processExitSpy.mockRestore();
    });

    describe('handleAuthLogin', () => {
        it('should authenticate and store token', async () => {
            const mockAuthProvider = {
                authenticate: vi.fn().mockResolvedValue(undefined),
                getStoredToken: vi.fn().mockResolvedValue('stored-token'),
            };

            const mockConfig = {
                auth: {
                    provider: 'oauth-device-flow',
                    options: { deviceAuthorizationEndpoint: 'https://auth.example.com/device' },
                },
            };

            vi.mocked(loadCliConfig).mockResolvedValue(mockConfig as any);
            vi.mocked(createAuthProvider).mockReturnValue(mockAuthProvider as any);
            vi.mocked(loadCredentialProvider).mockReturnValue({} as any);

            await handleAuthLogin(undefined, false);

            expect(mockAuthProvider.authenticate).toHaveBeenCalled();
            expect(consoleLogSpy).toHaveBeenCalledWith('✓ Authentication successful!');
            expect(consoleLogSpy).toHaveBeenCalledWith('✓ Token stored and will be used for subsequent requests');
        });

        it('should allow overriding provider from CLI', async () => {
            const mockAuthProvider = {
                authenticate: vi.fn().mockResolvedValue(undefined),
                getStoredToken: vi.fn().mockResolvedValue('token'),
            };

            const mockConfig = {
                auth: {
                    provider: 'oauth-device-flow',
                    options: {},
                },
            };

            vi.mocked(loadCliConfig).mockResolvedValue(mockConfig as any);
            vi.mocked(createAuthProvider).mockReturnValue(mockAuthProvider as any);
            vi.mocked(loadCredentialProvider).mockReturnValue({} as any);

            await handleAuthLogin('bearer-token', false);

            // Verify createAuthProvider was called with overridden provider
            expect(vi.mocked(createAuthProvider)).toHaveBeenCalledWith(
                expect.objectContaining({
                    provider: 'bearer-token',
                }),
                expect.anything()
            );
        });

        it('should exit with error if no config', async () => {
            vi.mocked(loadCliConfig).mockResolvedValue(null as any);

            await handleAuthLogin(undefined, false);

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('No authentication configured')
            );
            expect(processExitSpy).toHaveBeenCalledWith(1);
        });

        it('should handle authentication errors', async () => {
            const mockConfig = {
                auth: {
                    provider: 'oauth-device-flow',
                    options: {},
                },
            };

            const mockAuthProvider = {
                authenticate: vi.fn().mockRejectedValue(new Error('Auth server unavailable')),
            };

            vi.mocked(loadCliConfig).mockResolvedValue(mockConfig as any);
            vi.mocked(createAuthProvider).mockReturnValue(mockAuthProvider as any);
            vi.mocked(loadCredentialProvider).mockReturnValue({} as any);

            await handleAuthLogin(undefined, false);

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('Auth server unavailable')
            );
            expect(processExitSpy).toHaveBeenCalledWith(1);
        });
    });

    describe('handleAuthLogout', () => {
        it('should logout and clear credentials', async () => {
            const mockAuthProvider = {
                logout: vi.fn().mockResolvedValue(undefined),
            };

            const mockConfig = {
                auth: {
                    provider: 'oauth-device-flow',
                    options: {},
                },
            };

            vi.mocked(loadCliConfig).mockResolvedValue(mockConfig as any);
            vi.mocked(loadAuthProvider).mockReturnValue(mockAuthProvider as any);
            vi.mocked(loadCredentialProvider).mockReturnValue({} as any);

            await handleAuthLogout(false);

            expect(mockAuthProvider.logout).toHaveBeenCalled();
            expect(consoleLogSpy).toHaveBeenCalledWith('✓ Logged out successfully');
        });

        it('should handle missing config gracefully', async () => {
            vi.mocked(loadCliConfig).mockResolvedValue(null as any);

            await handleAuthLogout(false);

            expect(consoleLogSpy).toHaveBeenCalledWith('No credentials to logout from');
            expect(processExitSpy).not.toHaveBeenCalled();
        });

        it('should handle logout errors', async () => {
            const mockAuthProvider = {
                logout: vi.fn().mockRejectedValue(new Error('Storage access failed')),
            };

            const mockConfig = {
                auth: {
                    provider: 'bearer-token',
                    options: {},
                },
            };

            vi.mocked(loadCliConfig).mockResolvedValue(mockConfig as any);
            vi.mocked(loadAuthProvider).mockReturnValue(mockAuthProvider as any);
            vi.mocked(loadCredentialProvider).mockReturnValue({} as any);

            await handleAuthLogout(false);

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('Storage access failed')
            );
            expect(processExitSpy).toHaveBeenCalledWith(1);
        });
    });

    describe('handleAuthStatus', () => {
        it('should show authenticated status', async () => {
            const mockAuthProvider = {
                getStoredToken: vi.fn().mockResolvedValue('test-token-value'),
            };

            const mockConfig = {
                auth: {
                    provider: 'oauth-device-flow',
                    options: {},
                },
            };

            vi.mocked(loadCliConfig).mockResolvedValue(mockConfig as any);
            vi.mocked(loadAuthProvider).mockReturnValue(mockAuthProvider as any);

            await handleAuthStatus(false);

            expect(consoleLogSpy).toHaveBeenCalledWith('✓ Authenticated');
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Provider: oauth-device-flow'));
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Token available: yes'));
        });

        it('should show unauthenticated status when no token', async () => {
            const mockAuthProvider = {
                getStoredToken: vi.fn().mockResolvedValue(null),
            };

            const mockConfig = {
                auth: {
                    provider: 'bearer-token',
                    options: {},
                },
            };

            vi.mocked(loadCliConfig).mockResolvedValue(mockConfig as any);
            vi.mocked(loadAuthProvider).mockReturnValue(mockAuthProvider as any);

            await handleAuthStatus(false);

            expect(consoleLogSpy).toHaveBeenCalledWith('✗ Not authenticated');
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Run: calm auth login'));
        });

        it('should decode JWT token expiry', async () => {
            const futureTime = Math.floor(Date.now() / 1000) + 7200; // 2 hours from now
            const payload = Buffer.from(JSON.stringify({ exp: futureTime })).toString('base64');
            const jwtToken = `header.${payload}.signature`;

            const mockAuthProvider = {
                getStoredToken: vi.fn().mockResolvedValue(jwtToken),
            };

            const mockConfig = {
                auth: {
                    provider: 'oauth-authcode-flow',
                    options: {},
                },
            };

            vi.mocked(loadCliConfig).mockResolvedValue(mockConfig as any);
            vi.mocked(loadAuthProvider).mockReturnValue(mockAuthProvider as any);

            await handleAuthStatus(false);

            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('Expires in:')
            );
        });

        it('should handle missing config gracefully', async () => {
            vi.mocked(loadCliConfig).mockResolvedValue(null as any);

            await handleAuthStatus(false);

            expect(consoleLogSpy).toHaveBeenCalledWith('No authentication configured');
            expect(processExitSpy).not.toHaveBeenCalled();
        });
    });

    describe('handleAuthRefresh', () => {
        it('should refresh token successfully', async () => {
            const mockAuthProvider = {
                refresh: vi.fn().mockResolvedValue(true),
            };

            const mockConfig = {
                auth: {
                    provider: 'oauth-device-flow',
                    options: {},
                },
            };

            vi.mocked(loadCliConfig).mockResolvedValue(mockConfig as any);
            vi.mocked(loadAuthProvider).mockReturnValue(mockAuthProvider as any);

            await handleAuthRefresh(false);

            expect(mockAuthProvider.refresh).toHaveBeenCalled();
            expect(consoleLogSpy).toHaveBeenCalledWith('✓ Token refreshed successfully');
        });

        it('should handle token still valid case', async () => {
            const mockAuthProvider = {
                refresh: vi.fn().mockResolvedValue(false),
            };

            const mockConfig = {
                auth: {
                    provider: 'bearer-token',
                    options: {},
                },
            };

            vi.mocked(loadCliConfig).mockResolvedValue(mockConfig as any);
            vi.mocked(loadAuthProvider).mockReturnValue(mockAuthProvider as any);

            await handleAuthRefresh(false);

            expect(consoleLogSpy).toHaveBeenCalledWith('✓ Token is still valid');
        });

        it('should handle refresh errors', async () => {
            const mockAuthProvider = {
                refresh: vi.fn().mockRejectedValue(new Error('Refresh token expired')),
            };

            const mockConfig = {
                auth: {
                    provider: 'oauth-authcode-flow',
                    options: {},
                },
            };

            vi.mocked(loadCliConfig).mockResolvedValue(mockConfig as any);
            vi.mocked(loadAuthProvider).mockReturnValue(mockAuthProvider as any);

            await handleAuthRefresh(false);

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('Refresh token expired')
            );
            expect(processExitSpy).toHaveBeenCalledWith(1);
        });

        it('should error if no auth configured', async () => {
            vi.mocked(loadCliConfig).mockResolvedValue(null as any);

            await handleAuthRefresh(false);

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('No authentication configured')
            );
            expect(processExitSpy).toHaveBeenCalledWith(1);
        });
    });
});
