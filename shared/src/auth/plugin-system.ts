/**
 * Plugin system for CALM Hub authentication and credential providers
 *
 * Supports three loading mechanisms:
 * 1. Auto-discovery: Scans node_modules for packages with "calmPlugin": true
 * 2. Plugin config file: ~/.calm-plugins.json with explicit plugin list
 * 3. Environment variable: CALM_PLUGINS env var for override
 *
 * Enterprise plugins are standard npm packages that export an initialization function
 * which registers their providers with the registries.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
    AuthConfig,
    AuthProvider,
    CredentialProvider,
} from './auth-provider';

import { authProviderRegistry } from './auth-provider-registry';
import { credentialProviderRegistry } from './credential-provider-registry';

import { NoAuthProvider } from './providers/no-auth-provider';
import { FileCredentialProvider } from './credentials/file-credential-provider';
import { MemoryCredentialProvider } from './credentials/memory-credential-provider';

const PLUGINS_CONFIG_FILE = path.join(os.homedir(), '.calm-plugins.json');
const PLUGINS_ENV_VAR = 'CALM_PLUGINS';

/**
 * Plugin configuration file format
 */
export interface PluginsConfig {
    /** Array of npm package names to load */
    plugins?: string[];
    /** Optional: disable auto-discovery */
    disableAutoDiscovery?: boolean;
}

/**
 * Create an authentication provider from configuration
 * Looks up provider in registry by name and instantiates it
 *
 * @param config - Authentication configuration with provider name
 * @param credentialProvider - Credential provider for storing/retrieving tokens
 * @returns AuthProvider instance
 * @throws Error if provider not found in registry
 */
export function createAuthProvider(
    config: AuthConfig,
    credentialProvider: CredentialProvider,
): AuthProvider {
    const factory = authProviderRegistry.get(config.provider);
    if (!factory) {
        const available = authProviderRegistry.list();
        throw new Error(
            `Unknown authentication provider: "${config.provider}". ` +
            `Available providers: ${available.join(', ') || 'none'}. ` +
            `Ensure required plugins are installed and loaded.`,
        );
    }
    return factory(config, credentialProvider);
}

/**
 * Create a credential provider from name
 * Looks up provider in registry by name and instantiates it
 *
 * @param providerName - Name of credential provider (defaults to 'file')
 * @returns CredentialProvider instance
 * @throws Error if provider not found in registry
 */
export function createCredentialProvider(
    providerName: string = 'file',
): CredentialProvider {
    const factory = credentialProviderRegistry.get(providerName);
    if (!factory) {
        const available = credentialProviderRegistry.list();
        throw new Error(
            `Unknown credential provider: "${providerName}". ` +
            `Available providers: ${available.join(', ') || 'none'}. ` +
            `Check ~/.calm-plugins.json or CALM_PLUGINS env var.`,
        );
    }
    return factory();
}

/**
 * Initialize built-in providers
 * Called automatically when this module is imported
 */
function registerBuiltInProviders(): void {
    // Register built-in authentication providers
    authProviderRegistry.register('none', (config, credentialProvider) => {
        return new NoAuthProvider(config, credentialProvider);
    });

    // Bearer token provider will be registered when implemented in Step 2
    // authProviderRegistry.register('bearer-token', ...);
    // authProviderRegistry.register('oauth-device-flow', ...);
    // authProviderRegistry.register('oauth-authcode-flow', ...);

    // Register built-in credential providers
    credentialProviderRegistry.register('file', () => {
        return new FileCredentialProvider();
    });

    credentialProviderRegistry.register('memory', () => {
        return new MemoryCredentialProvider();
    });
}

/**
 * Load plugins from ~/.calm-plugins.json
 * File format:
 * {
 *   "plugins": ["@mycompany/calm-auth-azure-ad", "@mycompany/calm-creds-vault"],
 *   "disableAutoDiscovery": false
 * }
 */
function loadPluginsFromConfig(): string[] {
    if (!fs.existsSync(PLUGINS_CONFIG_FILE)) {
        return [];
    }

    try {
        const content = fs.readFileSync(PLUGINS_CONFIG_FILE, 'utf-8');
        const config = JSON.parse(content) as PluginsConfig;
        return config.plugins || [];
    } catch (error) {
        console.warn(
            `Warning: Failed to load plugins config: ${PLUGINS_CONFIG_FILE}`,
            error,
        );
        return [];
    }
}

/**
 * Load plugins from CALM_PLUGINS environment variable
 * Format: "plugin1,plugin2,plugin3"
 */
function loadPluginsFromEnv(): string[] {
    const envValue = process.env[PLUGINS_ENV_VAR];
    if (!envValue) {
        return [];
    }
    return envValue.split(',').map((p) => p.trim());
}

/**
 * Load plugins from ~/.calm-plugins.json config file
 * Returns empty array if auto-discovery is disabled in config
 */
function loadPluginsFromAutoDiscovery(): string[] {
    // Check if auto-discovery is explicitly disabled
    if (fs.existsSync(PLUGINS_CONFIG_FILE)) {
        try {
            const content = fs.readFileSync(PLUGINS_CONFIG_FILE, 'utf-8');
            const config = JSON.parse(content) as PluginsConfig;
            if (config.disableAutoDiscovery) {
                return [];
            }
        } catch {
            // If config is malformed, proceed with auto-discovery
        }
    }

    const plugins: string[] = [];

    // Look for plugins in node_modules
    try {
        const nodeModules = path.join(process.cwd(), 'node_modules');
        if (!fs.existsSync(nodeModules)) {
            return [];
        }

        // Check scoped packages (@org/package)
        const scopedDir = path.join(nodeModules, '@');
        if (fs.existsSync(scopedDir)) {
            for (const org of fs.readdirSync(scopedDir)) {
                const orgPath = path.join(scopedDir, org);
                if (!fs.statSync(orgPath).isDirectory()) continue;

                for (const pkgName of fs.readdirSync(orgPath)) {
                    const pkgPath = path.join(orgPath, pkgName);
                    if (!fs.statSync(pkgPath).isDirectory()) continue;

                    if (hasPluginMarker(pkgPath)) {
                        plugins.push(`@${org}/${pkgName}`);
                    }
                }
            }
        }

        // Check unscoped packages
        for (const pkgName of fs.readdirSync(nodeModules)) {
            if (pkgName.startsWith('.')) continue; // Skip .bin, etc.
            if (pkgName === '@') continue; // Already processed

            const pkgPath = path.join(nodeModules, pkgName);
            if (!fs.statSync(pkgPath).isDirectory()) continue;

            if (hasPluginMarker(pkgPath)) {
                plugins.push(pkgName);
            }
        }
    } catch (error) {
        // Log but don't fail - auto-discovery is optional
        console.debug(
            'Debug: Auto-discovery of CALM plugins failed',
            error instanceof Error ? error.message : String(error),
        );
    }

    return plugins;
}

/**
 * Check if a package has calmPlugin marker in package.json
 */
function hasPluginMarker(pkgPath: string): boolean {
    try {
        const pkgJsonPath = path.join(pkgPath, 'package.json');
        if (!fs.existsSync(pkgJsonPath)) {
            return false;
        }

        const content = fs.readFileSync(pkgJsonPath, 'utf-8');
        const pkgJson = JSON.parse(content) as Record<string, unknown>;
        return pkgJson.calmPlugin === true;
    } catch {
        return false;
    }
}

/**
 * Load plugins in priority order
 * 1. Env var (CALM_PLUGINS) - highest priority
 * 2. Config file (~/.calm-plugins.json) - medium priority
 * 3. Auto-discovery (node_modules) - lowest priority
 * Later plugins can override earlier ones
 */
async function loadPlugins(): Promise<void> {
    const pluginSet = new Set<string>();

    // Add auto-discovered plugins first (lowest priority)
    for (const plugin of loadPluginsFromAutoDiscovery()) {
        pluginSet.add(plugin);
    }

    // Add from config file (higher priority, overwrites auto-discovered)
    for (const plugin of loadPluginsFromConfig()) {
        pluginSet.add(plugin);
    }

    // Add from env var (highest priority)
    for (const plugin of loadPluginsFromEnv()) {
        pluginSet.add(plugin);
    }

    // Load plugins in order
    for (const pluginName of pluginSet) {
        try {
            await loadPlugin(pluginName);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`Failed to load plugin "${pluginName}": ${errorMsg}`);
            // Don't throw - allow other plugins to load
        }
    }
}

/**
 * Load a single plugin by name
 * Plugin must export:
 * - default export: function that registers providers
 * - Or: initialize() function that registers providers
 */
async function loadPlugin(pluginName: string): Promise<void> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const plugin = await import(pluginName);

        // Call the initialization function
        if (typeof plugin.default === 'function') {
            plugin.default();
        } else if (typeof plugin.initialize === 'function') {
            plugin.initialize();
        } else {
            console.warn(
                `Warning: Plugin "${pluginName}" does not export default function or initialize()`,
            );
        }
    } catch (error) {
        throw new Error(
            `Failed to load plugin "${pluginName}": ${error instanceof Error ? error.message : String(error)}`,
        );
    }
}

/**
 * Initialize the authentication system
 * Call this once at application startup to:
 * 1. Register built-in providers
 * 2. Load and initialize plugins
 */
export async function initializeAuthSystem(): Promise<void> {
    // Register built-in providers first
    registerBuiltInProviders();

    // Load and initialize plugins
    await loadPlugins();
}

/**
 * Synchronous initialization for use in constructors/module initialization
 * Use for CLI where async initialization is expected at startup
 * Use initializeAuthSystem() for async-safe contexts
 */
export function initializeAuthSystemSync(): void {
    // Register built-in providers
    registerBuiltInProviders();

    // Note: loadPlugins() is async, so plugins need to be loaded separately
    // This is called for built-in providers, plugins should be loaded with initializeAuthSystem()
}

// Re-export registries for convenient importing
export { authProviderRegistry, credentialProviderRegistry };
export { FileCredentialProvider, MemoryCredentialProvider, NoAuthProvider };
