/**
 * Authentication module - core abstractions, factories, and plugin system for CALM Hub authentication
 *
 * This module provides:
 * - AuthProvider interface: plugin-based authentication implementations
 * - CredentialProvider interface: pluggable credential storage mechanisms
 * - Provider registries: for registering custom implementations
 * - Factory functions: createAuthProvider(), createCredentialProvider()
 * - Plugin system: auto-discovery, config file, env var support
 *
 * Enterprise Usage:
 * 1. Create npm package implementing custom AuthProvider for your IdP (Azure AD, AWS IAM, SAML, etc.)
 * 2. Set calmPlugin: true in package.json
 * 3. Export register function that calls authProviderRegistry.register()
 * 4. Install package: npm install @mycompany/calm-auth-myidp
 * 5. Automatically loads (or configure in ~/.calm-plugins.json)
 * 6. Use in config: { "auth": { "provider": "myidp", ... } }
 */

export {
    AuthConfig,
    AuthProvider,
    AuthProviderRegistry,
    CredentialProvider,
    CredentialProviderRegistry,
    TokenResponse,
} from './auth-provider';

export { authProviderRegistry } from './auth-provider-registry';
export { credentialProviderRegistry } from './credential-provider-registry';

// Factory functions
export {
    createAuthProvider,
    createCredentialProvider,
    initializeAuthSystem,
    initializeAuthSystemSync,
    type PluginsConfig,
} from './plugin-system';

// Credential providers
export { FileCredentialProvider } from './credentials/file-credential-provider';
export { MemoryCredentialProvider } from './credentials/memory-credential-provider';

// Auth providers
export { NoAuthProvider } from './providers/no-auth-provider';
export { BearerTokenProvider, RetrievableBearerTokenProvider } from './providers/bearer-token-provider';
export { OAuthDeviceFlowProvider } from './providers/oauth-device-flow-provider';
export { OAuthAuthCodeFlowProvider } from './providers/oauth-authcode-flow-provider';
