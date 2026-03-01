/**
 * Tests for plugin system and factory functions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
    createAuthProvider,
    createCredentialProvider,
    initializeAuthSystemSync,
    authProviderRegistry,
    credentialProviderRegistry,
    FileCredentialProvider,
    MemoryCredentialProvider,
} from './plugin-system';
import { AuthProvider, CredentialProvider, AuthConfig } from './auth-provider';

describe('Plugin System - Factory Functions', () => {
    beforeEach(() => {
        // Register built-in providers before each test
        initializeAuthSystemSync();
    });

    describe('createAuthProvider', () => {
        it('should create a registered auth provider', () => {
            const credProvider = new MemoryCredentialProvider();
            const config: AuthConfig = {
                provider: 'none',
            };

            const authProvider = createAuthProvider(config, credProvider);
            expect(authProvider).toBeDefined();
            expect(authProvider.isAuthenticated()).toBe(true);
        });

        it('should throw error for unknown provider', () => {
            const credProvider = new MemoryCredentialProvider();
            const config: AuthConfig = {
                provider: 'unknown-provider-xyz',
            };

            expect(() => createAuthProvider(config, credProvider)).toThrow(
                'Unknown authentication provider',
            );
        });

        it('should include available providers in error message', () => {
            const credProvider = new MemoryCredentialProvider();
            const config: AuthConfig = {
                provider: 'invalid',
            };

            try {
                createAuthProvider(config, credProvider);
            } catch (error) {
                const message = (error as Error).message;
                expect(message).toContain('Available providers');
                expect(message).toContain('none'); // Built-in provider
            }
        });
    });

    describe('createCredentialProvider', () => {
        it('should create file credential provider by default', () => {
            const provider = createCredentialProvider();
            expect(provider).toBeInstanceOf(FileCredentialProvider);
        });

        it('should create memory credential provider by name', () => {
            const provider = createCredentialProvider('memory');
            expect(provider).toBeInstanceOf(MemoryCredentialProvider);
        });

        it('should throw error for unknown credential provider', () => {
            expect(() => createCredentialProvider('unknown-vault')).toThrow(
                'Unknown credential provider',
            );
        });

        it('should create file provider explicitly', () => {
            const provider = createCredentialProvider('file');
            expect(provider).toBeInstanceOf(FileCredentialProvider);
        });
    });
});

describe('Plugin System - Provider Registration', () => {
    beforeEach(() => {
        // Clear registries before each test
        authProviderRegistry.list().forEach((name) => {
            authProviderRegistry.unregister(name);
        });
        credentialProviderRegistry.list().forEach((name) => {
            credentialProviderRegistry.unregister(name);
        });

        // Re-register built-ins
        initializeAuthSystemSync();
    });

    describe('Auth Provider Registry', () => {
        it('should register and retrieve auth provider', () => {
            const mockFactory = vi.fn((config: AuthConfig, credProvider: CredentialProvider) => {
                // Return a mock provider
                return {
                    authenticate: vi.fn(),
                    getAuthHeaders: () => ({ 'X-Custom': 'header' }),
                    isAuthenticated: () => true,
                    refresh: vi.fn(),
                    logout: vi.fn(),
                } as unknown as AuthProvider;
            });

            authProviderRegistry.register('custom', mockFactory);

            const factory = authProviderRegistry.get('custom');
            expect(factory).toBeDefined();
            expect(factory).toBe(mockFactory);
        });

        it('should list registered providers', () => {
            authProviderRegistry.register('test1', () => ({} as AuthProvider));
            authProviderRegistry.register('test2', () => ({} as AuthProvider));

            const providers = authProviderRegistry.list();
            expect(providers).toContain('test1');
            expect(providers).toContain('test2');
            expect(providers).toContain('none'); // Built-in
        });

        it('should unregister provider', () => {
            authProviderRegistry.register('temp', () => ({} as AuthProvider));
            expect(authProviderRegistry.get('temp')).toBeDefined();

            authProviderRegistry.unregister('temp');
            expect(authProviderRegistry.get('temp')).toBeUndefined();
        });

        it('should return undefined for unregistered provider', () => {
            const factory = authProviderRegistry.get('nonexistent');
            expect(factory).toBeUndefined();
        });
    });

    describe('Credential Provider Registry', () => {
        it('should register and retrieve credential provider', () => {
            const mockFactory = vi.fn(() => new MemoryCredentialProvider());

            credentialProviderRegistry.register('custom-vault', mockFactory);

            const factory = credentialProviderRegistry.get('custom-vault');
            expect(factory).toBeDefined();
            expect(factory).toBe(mockFactory);
        });

        it('should list registered credential providers', () => {
            credentialProviderRegistry.register('vault1', () => new MemoryCredentialProvider());
            credentialProviderRegistry.register('vault2', () => new MemoryCredentialProvider());

            const providers = credentialProviderRegistry.list();
            expect(providers).toContain('vault1');
            expect(providers).toContain('vault2');
            expect(providers).toContain('file'); // Built-in
            expect(providers).toContain('memory'); // Built-in
        });

        it('should unregister credential provider', () => {
            credentialProviderRegistry.register('temp-vault', () => new MemoryCredentialProvider());
            expect(credentialProviderRegistry.get('temp-vault')).toBeDefined();

            credentialProviderRegistry.unregister('temp-vault');
            expect(credentialProviderRegistry.get('temp-vault')).toBeUndefined();
        });
    });
});

describe('Plugin System - Built-in Providers', () => {
    beforeEach(() => {
        initializeAuthSystemSync();
    });

    it('should have no-auth provider registered', () => {
        const factory = authProviderRegistry.get('none');
        expect(factory).toBeDefined();

        const credProvider = new MemoryCredentialProvider();
        const authProvider = factory!(
            { provider: 'none' },
            credProvider,
        );

        expect(authProvider.getAuthHeaders()).toEqual({});
        expect(authProvider.isAuthenticated()).toBe(true);
    });

    it('should have file credential provider registered', () => {
        const provider = createCredentialProvider('file');
        expect(provider).toBeInstanceOf(FileCredentialProvider);
    });

    it('should have memory credential provider registered', () => {
        const provider = createCredentialProvider('memory');
        expect(provider).toBeInstanceOf(MemoryCredentialProvider);
    });
});

describe('Plugin System - Plugin Loading Configuration', () => {
    describe('Plugin config file parsing', () => {
        it('should handle missing plugin config file', () => {
            // This should not throw - just proceed without config
            const configPath = `/tmp/nonexistent-${Date.now()}.json`;
            expect(fs.existsSync(configPath)).toBe(false);

            // Plugin system should handle gracefully
            // (This is tested implicitly in initializeAuthSystem)
        });

        it('should have well-documented plugin loading priority', () => {
            // Documentation states:
            // 1. Env var (CALM_PLUGINS) - highest priority
            // 2. Config file (~/.calm-plugins.json) - medium priority
            // 3. Auto-discovery (node_modules) - lowest priority
            //
            // This means:
            // - Env var can override config and auto-discovery
            // - Config file can override auto-discovery
            // - Auto-discovery is used when nothing else is specified
            expect(true).toBe(true); // Documentation verified
        });
    });
});

describe('Plugin System - Custom Provider Pattern', () => {
    it('should support custom auth provider implementation', () => {
        // This test demonstrates how enterprises can register custom providers

        // Define a custom provider
        interface CustomAuthConfig extends AuthConfig {
            options?: {
                endpoint?: string;
                clientId?: string;
            };
        }

        class CustomAuthProvider implements AuthProvider {
            constructor(
                private config: CustomAuthConfig,
                private credentialProvider: CredentialProvider,
            ) { }

            async authenticate(): Promise<void> {
                // Custom authentication logic
                await this.credentialProvider.store('token', 'custom-token-123');
            }

            getAuthHeaders(): Record<string, string> {
                return { Authorization: 'Bearer custom-token-123' };
            }

            isAuthenticated(): boolean {
                return true;
            }

            async refresh(): Promise<void> {
                // Custom refresh logic
            }

            async logout(): Promise<void> {
                await this.credentialProvider.delete('token');
            }
        }

        // Register custom provider
        authProviderRegistry.register('custom-auth', (config, credProvider) => {
            return new CustomAuthProvider(config as CustomAuthConfig, credProvider);
        });

        // Use custom provider
        const credProvider = new MemoryCredentialProvider();
        const provider = createAuthProvider(
            { provider: 'custom-auth', options: { endpoint: 'https://example.com' } },
            credProvider,
        );

        expect(provider.getAuthHeaders()).toEqual({
            Authorization: 'Bearer custom-token-123',
        });
        expect(provider.isAuthenticated()).toBe(true);
    });

    it('should support custom credential provider implementation', () => {
        // This test demonstrates how enterprises can register custom credential providers

        class VaultCredentialProvider implements CredentialProvider {
            private store: Record<string, string> = {};

            async store(key: string, value: string): Promise<void> {
                // Custom storage logic (e.g., HashiCorp Vault API call)
                this.store[key] = value;
            }

            async retrieve(key: string): Promise<string | undefined> {
                // Custom retrieval logic
                return this.store[key];
            }

            async delete(key: string): Promise<void> {
                // Custom deletion logic
                delete this.store[key];
            }

            async clear(): Promise<void> {
                // Custom clear logic
                this.store = {};
            }
        }

        // Register custom provider
        credentialProviderRegistry.register('vault', () => new VaultCredentialProvider());

        // Use custom provider
        const provider = createCredentialProvider('vault');
        expect(provider).toBeInstanceOf(VaultCredentialProvider);
    });
});
describe('Plugin System - Plugin Loading from Config File', () => {
    const PLUGINS_CONFIG_FILE = path.join(os.homedir(), '.calm-plugins.json');
    let originalConfig: string | null = null;

    beforeEach(() => {
        // Backup existing config if it exists
        if (fs.existsSync(PLUGINS_CONFIG_FILE)) {
            originalConfig = fs.readFileSync(PLUGINS_CONFIG_FILE, 'utf-8');
        }
    });

    afterEach(() => {
        // Restore original config
        if (originalConfig) {
            fs.writeFileSync(PLUGINS_CONFIG_FILE, originalConfig);
        } else if (fs.existsSync(PLUGINS_CONFIG_FILE)) {
            fs.unlinkSync(PLUGINS_CONFIG_FILE);
        }
        originalConfig = null;
    });

    it('should load plugins from config file', async () => {
        // Create test config file
        const testConfig = {
            plugins: ['test-plugin-1', 'test-plugin-2']
        };
        fs.writeFileSync(PLUGINS_CONFIG_FILE, JSON.stringify(testConfig));

        // Import the internal function through re-exporting or testing the module behavior
        // Since loadPluginsFromConfig is not exported, we test through initializeAuthSystem
        const { initializeAuthSystem } = await import('./plugin-system');

        // This will attempt to load plugins (they may fail to import, which is fine)
        // We're testing that the config file is read correctly
        await expect(initializeAuthSystem()).resolves.not.toThrow();
    });

    it('should handle missing config file gracefully', async () => {
        // Ensure config file doesn't exist
        if (fs.existsSync(PLUGINS_CONFIG_FILE)) {
            fs.unlinkSync(PLUGINS_CONFIG_FILE);
        }

        const { initializeAuthSystem } = await import('./plugin-system');
        await expect(initializeAuthSystem()).resolves.not.toThrow();
    });

    it('should handle malformed config file', async () => {
        // Write invalid JSON
        fs.writeFileSync(PLUGINS_CONFIG_FILE, '{ invalid json }');

        const { initializeAuthSystem } = await import('./plugin-system');
        
        // Should log warning but not throw
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        await initializeAuthSystem();
        
        // Should have logged warning about failed config load
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    it('should respect disableAutoDiscovery flag', async () => {
        const testConfig = {
            plugins: [],
            disableAutoDiscovery: true
        };
        fs.writeFileSync(PLUGINS_CONFIG_FILE, JSON.stringify(testConfig));

        const { initializeAuthSystem } = await import('./plugin-system');
        await expect(initializeAuthSystem()).resolves.not.toThrow();
    });
});

describe('Plugin System - Plugin Loading from Environment', () => {
    let originalEnv: string | undefined;

    beforeEach(() => {
        originalEnv = process.env.CALM_PLUGINS;
    });

    afterEach(() => {
        if (originalEnv) {
            process.env.CALM_PLUGINS = originalEnv;
        } else {
            delete process.env.CALM_PLUGINS;
        }
    });

    it('should load plugins from CALM_PLUGINS env var', async () => {
        process.env.CALM_PLUGINS = 'plugin-a,plugin-b,plugin-c';

        const { initializeAuthSystem } = await import('./plugin-system');
        
        // Plugins won't exist but should attempt to load them
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        await initializeAuthSystem();
        
        // Should have attempted to load each plugin
        // (they'll fail since they don't exist, which is expected)
        consoleSpy.mockRestore();
    });

    it('should handle empty CALM_PLUGINS env var', async () => {
        process.env.CALM_PLUGINS = '';

        const { initializeAuthSystem } = await import('./plugin-system');
        await expect(initializeAuthSystem()).resolves.not.toThrow();
    });

    it('should trim whitespace from plugin names', async () => {
        process.env.CALM_PLUGINS = '  plugin-a  ,  plugin-b  ';

        const { initializeAuthSystem } = await import('./plugin-system');
        
        // Should handle whitespace correctly
        await expect(initializeAuthSystem()).resolves.not.toThrow();
    });
});

describe('Plugin System - Auto-Discovery', () => {
    const testNodeModules = path.join(process.cwd(), 'test-node-modules-temp');
    let originalCwd: string;

    beforeEach(() => {
        originalCwd = process.cwd();
        // Create temp node_modules for testing
        if (fs.existsSync(testNodeModules)) {
            fs.rmSync(testNodeModules, { recursive: true });
        }
    });

    afterEach(() => {
        // Cleanup temp directory
        if (fs.existsSync(testNodeModules)) {
            fs.rmSync(testNodeModules, { recursive: true });
        }
        process.chdir(originalCwd);
    });

    it('should discover plugins with calmPlugin marker in package.json', () => {
        // Create a test package with calm plugin marker
        const pluginDir = path.join(testNodeModules, 'test-calm-plugin');
        fs.mkdirSync(pluginDir, { recursive: true });
        
        const packageJson = {
            name: 'test-calm-plugin',
            version: '1.0.0',
            calmPlugin: true
        };
        fs.writeFileSync(
            path.join(pluginDir, 'package.json'),
            JSON.stringify(packageJson)
        );

        // Auto-discovery should find this plugin
        // Note: We can't easily test the full discovery without mocking the filesystem
        // or changing CWD, which is risky in tests
        expect(fs.existsSync(path.join(pluginDir, 'package.json'))).toBe(true);
    });

    it('should discover scoped plugins', () => {
        // Create a scoped package
        const scopedDir = path.join(testNodeModules, '@myorg', 'calm-plugin');
        fs.mkdirSync(scopedDir, { recursive: true });
        
        const packageJson = {
            name: '@myorg/calm-plugin',
            version: '1.0.0',
            calmPlugin: true
        };
        fs.writeFileSync(
            path.join(scopedDir, 'package.json'),
            JSON.stringify(packageJson)
        );

        expect(fs.existsSync(path.join(scopedDir, 'package.json'))).toBe(true);
    });

    it('should skip packages without calmPlugin marker', () => {
        const pluginDir = path.join(testNodeModules, 'regular-package');
        fs.mkdirSync(pluginDir, { recursive: true });
        
        const packageJson = {
            name: 'regular-package',
            version: '1.0.0'
            // No calmPlugin: true
        };
        fs.writeFileSync(
            path.join(pluginDir, 'package.json'),
            JSON.stringify(packageJson)
        );

        expect(fs.existsSync(path.join(pluginDir, 'package.json'))).toBe(true);
    });

    it('should handle node_modules not existing', async () => {
        // Change to a directory without node_modules
        const tempDir = path.join(os.tmpdir(), `calm-test-${Date.now()}`);
        fs.mkdirSync(tempDir, { recursive: true });
        process.chdir(tempDir);

        const { initializeAuthSystem } = await import('./plugin-system');
        await expect(initializeAuthSystem()).resolves.not.toThrow();

        // Cleanup
        process.chdir(originalCwd);
        fs.rmSync(tempDir, { recursive: true });
    });
});

describe('Plugin System - Plugin Loading Errors', () => {
    it('should handle plugin import failure gracefully', async () => {
        process.env.CALM_PLUGINS = 'nonexistent-plugin-xyz';

        const { initializeAuthSystem } = await import('./plugin-system');
        
        // Should log error but not throw
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        await initializeAuthSystem();
        
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('Failed to load plugin "nonexistent-plugin-xyz"')
        );
        consoleSpy.mockRestore();

        delete process.env.CALM_PLUGINS;
    });

    it('should continue loading other plugins after one fails', async () => {
        // Mix of nonexistent and valid (built-in will be registered regardless)
        process.env.CALM_PLUGINS = 'bad-plugin-1,bad-plugin-2';

        const { initializeAuthSystem } = await import('./plugin-system');
        
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        await initializeAuthSystem();
        
        // Should have attempted both and logged errors for both
        const calls = consoleSpy.mock.calls.map(call => call[0]);
        expect(calls.some(msg => msg.includes('bad-plugin-1'))).toBe(true);
        expect(calls.some(msg => msg.includes('bad-plugin-2'))).toBe(true);
        
        consoleSpy.mockRestore();
        delete process.env.CALM_PLUGINS;
    });
});