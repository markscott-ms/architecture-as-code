/**
 * Credential provider registry - allows registering custom storage implementations
 * Enables enterprises to register custom credential providers (Vault, Azure Key Vault, AWS Secrets Manager, etc.)
 */

import { CredentialProvider, CredentialProviderRegistry } from './auth-provider';

class CredentialProviderRegistryImpl implements CredentialProviderRegistry {
    private providers: Map<string, () => CredentialProvider> = new Map();

    register(name: string, factory: () => CredentialProvider): void {
        this.providers.set(name, factory);
    }

    unregister(name: string): void {
        this.providers.delete(name);
    }

    get(name: string): (() => CredentialProvider) | undefined {
        return this.providers.get(name);
    }

    list(): string[] {
        return Array.from(this.providers.keys());
    }
}

// Global registry instance
export const credentialProviderRegistry = new CredentialProviderRegistryImpl();
