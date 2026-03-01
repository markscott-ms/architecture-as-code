/**
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { VscodeSecretCredentialProvider } from './vscode-secret-credential-provider'
import type * as vscode from 'vscode'

describe('VscodeSecretCredentialProvider', () => {
    let mockSecrets: vscode.SecretStorage
    let provider: VscodeSecretCredentialProvider

    beforeEach(() => {
        // Create mock VSCode SecretStorage
        const storage = new Map<string, string>()
        mockSecrets = {
            get: vi.fn(async (key: string) => storage.get(key)),
            store: vi.fn(async (key: string, value: string) => {
                storage.set(key, value)
            }),
            delete: vi.fn(async (key: string) => {
                storage.delete(key)
            }),
            onDidChange: vi.fn()
        } as unknown as vscode.SecretStorage

        provider = new VscodeSecretCredentialProvider(mockSecrets)
    })

    describe('store', () => {
        it('should store a credential with prefix', async () => {
            await provider.store('test-key', 'test-value')

            expect(mockSecrets.store).toHaveBeenCalledWith('calm.credentials.test-key', 'test-value')
        })

        it('should store multiple credentials', async () => {
            await provider.store('key1', 'value1')
            await provider.store('key2', 'value2')

            expect(mockSecrets.store).toHaveBeenCalledWith('calm.credentials.key1', 'value1')
            expect(mockSecrets.store).toHaveBeenCalledWith('calm.credentials.key2', 'value2')
        })
    })

    describe('retrieve', () => {
        it('should retrieve a stored credential', async () => {
            await provider.store('test-key', 'test-value')
            const value = await provider.retrieve('test-key')

            expect(value).toBe('test-value')
            expect(mockSecrets.get).toHaveBeenCalledWith('calm.credentials.test-key')
        })

        it('should return undefined for non-existent key', async () => {
            const value = await provider.retrieve('non-existent')

            expect(value).toBeUndefined()
        })

        it('should retrieve correct value when multiple keys exist', async () => {
            await provider.store('key1', 'value1')
            await provider.store('key2', 'value2')

            const value1 = await provider.retrieve('key1')
            const value2 = await provider.retrieve('key2')

            expect(value1).toBe('value1')
            expect(value2).toBe('value2')
        })
    })

    describe('delete', () => {
        it('should delete a stored credential', async () => {
            await provider.store('test-key', 'test-value')
            await provider.delete('test-key')

            const value = await provider.retrieve('test-key')
            expect(value).toBeUndefined()
            expect(mockSecrets.delete).toHaveBeenCalledWith('calm.credentials.test-key')
        })

        it('should not error when deleting non-existent key', async () => {
            await expect(provider.delete('non-existent')).resolves.not.toThrow()
        })
    })

    describe('clear', () => {
        it('should clear all known credential keys', async () => {
            await provider.store('access_token', 'token123')
            await provider.store('refresh_token', 'refresh456')
            await provider.store('token_expiry', '1234567890')

            await provider.clear()

            expect(mockSecrets.delete).toHaveBeenCalledWith('calm.credentials.access_token')
            expect(mockSecrets.delete).toHaveBeenCalledWith('calm.credentials.refresh_token')
            expect(mockSecrets.delete).toHaveBeenCalledWith('calm.credentials.token_expiry')
        })

        it('should attempt to clear all known keys even if some do not exist', async () => {
            await provider.store('access_token', 'token123')
            // Don't store refresh_token - it doesn't exist

            await provider.clear()

            // Should still try to delete both
            expect(mockSecrets.delete).toHaveBeenCalledWith('calm.credentials.access_token')
            expect(mockSecrets.delete).toHaveBeenCalledWith('calm.credentials.refresh_token')
        })

        it('should not throw error even if delete operations fail', async () => {
            // Mock delete to throw error
            mockSecrets.delete = vi.fn(async () => {
                throw new Error('Delete failed')
            })

            // Should not throw
            await expect(provider.clear()).resolves.not.toThrow()
        })
    })

    describe('integration with authentication flows', () => {
        it('should support OAuth token storage workflow', async () => {
            // Simulate OAuth flow storing tokens
            await provider.store('access_token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...')
            await provider.store('refresh_token', 'refresh_abc123')
            await provider.store('token_expiry', String(Date.now() + 3600000))

            // Verify tokens can be retrieved
            const accessToken = await provider.retrieve('access_token')
            const refreshToken = await provider.retrieve('refresh_token')
            const expiry = await provider.retrieve('token_expiry')

            expect(accessToken).toBeTruthy()
            expect(refreshToken).toBeTruthy()
            expect(expiry).toBeTruthy()
        })

        it('should support logout workflow', async () => {
            // Simulate authenticated state
            await provider.store('access_token', 'token123')
            await provider.store('refresh_token', 'refresh456')

            // Simulate logout
            await provider.clear()

            // Verify tokens are removed
            const accessToken = await provider.retrieve('access_token')
            const refreshToken = await provider.retrieve('refresh_token')

            expect(accessToken).toBeUndefined()
            expect(refreshToken).toBeUndefined()
        })
    })

    describe('credential key prefixing', () => {
        it('should use calm.credentials prefix to avoid conflicts', async () => {
            await provider.store('my-key', 'my-value')

            // Verify the actual key stored includes prefix
            expect(mockSecrets.store).toHaveBeenCalledWith(
                'calm.credentials.my-key',
                'my-value'
            )
        })

        it('should handle keys with special characters', async () => {
            await provider.store('oauth2.token:access', 'value')

            expect(mockSecrets.store).toHaveBeenCalledWith(
                'calm.credentials.oauth2.token:access',
                'value'
            )
        })
    })
})
