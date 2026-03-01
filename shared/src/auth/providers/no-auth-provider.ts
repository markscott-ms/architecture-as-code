/**
 * No-Auth Provider - pass-through provider for unauthenticated access
 * Used when authentication is not configured or for local development
 */

import { AuthConfig, AuthProvider, CredentialProvider } from '../auth-provider';

/**
 * Provider that performs no authentication - returns empty headers
 * Used when auth is disabled or for unauthenticated local workflows
 */
export class NoAuthProvider implements AuthProvider {
    constructor(
        _config: AuthConfig,
        _credentialProvider: CredentialProvider,
    ) {
        // No initialization needed
    }

    async authenticate(): Promise<void> {
        // No-op
    }

    getAuthHeaders(): Record<string, string> {
        // Return empty headers - no authentication
        return {};
    }

    isAuthenticated(): boolean {
        // Always return true for no-auth (no auth needed)
        return true;
    }

    async refresh(): Promise<void> {
        // No-op - nothing to refresh
    }

    async logout(): Promise<void> {
        // No-op
    }
}
