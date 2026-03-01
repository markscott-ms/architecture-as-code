/**
 * Authentication provider registry - allows registering custom implementations
 * Enables enterprises to register custom auth providers (Azure AD, AWS IAM, SAML, etc.)
 */

import { AuthConfig, AuthProvider, AuthProviderRegistry, CredentialProvider } from './auth-provider';

class AuthProviderRegistryImpl implements AuthProviderRegistry {
    private providers: Map<
        string,
        (config: AuthConfig, credentialProvider: CredentialProvider) => AuthProvider
    > = new Map();

    register(
        name: string,
        factory: (
            config: AuthConfig,
            credentialProvider: CredentialProvider,
        ) => AuthProvider,
    ): void {
        this.providers.set(name, factory);
    }

    unregister(name: string): void {
        this.providers.delete(name);
    }

    get(
        name: string,
    ):
        | ((
            config: AuthConfig,
            credentialProvider: CredentialProvider,
        ) => AuthProvider)
        | undefined {
        return this.providers.get(name);
    }

    list(): string[] {
        return Array.from(this.providers.keys());
    }
}

// Global registry instance
export const authProviderRegistry = new AuthProviderRegistryImpl();
