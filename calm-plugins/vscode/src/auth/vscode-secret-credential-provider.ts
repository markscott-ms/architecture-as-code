/**
 * VSCode SecretStorage credential provider
 * 
 * Wraps VSCode's SecretStorage API to provide secure credential storage
 * using the operating system's keychain:
 * - macOS: Keychain
 * - Windows: Credential Manager
 * - Linux: Secret Service API (libsecret)
 * 
 * This is more secure than file-based storage as credentials are encrypted
 * and managed by the OS.
 */

import * as vscode from 'vscode'
import type { CredentialProvider } from '@finos/calm-shared'

const CREDENTIAL_PREFIX = 'calm.credentials.'

/**
 * Credential provider that uses VSCode's SecretStorage API
 * Stores credentials in OS keychain for improved security
 */
export class VscodeSecretCredentialProvider implements CredentialProvider {
    constructor(private readonly secrets: vscode.SecretStorage) { }

    async store(key: string, value: string): Promise<void> {
        await this.secrets.store(`${CREDENTIAL_PREFIX}${key}`, value)
    }

    async retrieve(key: string): Promise<string | undefined> {
        return await this.secrets.get(`${CREDENTIAL_PREFIX}${key}`)
    }

    async delete(key: string): Promise<void> {
        await this.secrets.delete(`${CREDENTIAL_PREFIX}${key}`)
    }

    /**
     * Clear all CALM credentials from SecretStorage
     * Note: VSCode doesn't provide an API to list all keys, so we clear known keys
     */
    async clear(): Promise<void> {
        // Clear known credential keys
        const knownKeys = [
            'access_token',
            'refresh_token',
            'token_expiry',
            'device_code',
            'user_code',
        ]

        for (const key of knownKeys) {
            try {
                await this.delete(key)
            } catch (error) {
                // Ignore errors when deleting non-existent keys
            }
        }
    }
}
