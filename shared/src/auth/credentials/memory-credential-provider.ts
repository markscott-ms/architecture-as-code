/**
 * In-memory credential provider
 * Stores credentials in memory only - lost when process exits
 * Used for testing and CI environments
 */

import { CredentialProvider } from '../auth-provider';

interface StoredCredentials {
    [key: string]: string;
}

/**
 * Stores credentials in memory only
 * Useful for testing, CI/CD, or when credential persistence is not needed
 */
export class MemoryCredentialProvider implements CredentialProvider {
    private credentials: StoredCredentials = {};

    async store(key: string, value: string): Promise<void> {
        this.credentials[key] = value;
    }

    async retrieve(key: string): Promise<string | undefined> {
        return this.credentials[key];
    }

    async delete(key: string): Promise<void> {
        delete this.credentials[key];
    }

    async clear(): Promise<void> {
        this.credentials = {};
    }
}
