import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Config } from '../core/ports/config'
import type { Logger } from '../core/ports/logger'

// Mock vscode module
vi.mock('vscode', () => ({
    window: {
        showErrorMessage: vi.fn(),
        showInformationMessage: vi.fn(),
        showWarningMessage: vi.fn(),
        withProgress: vi.fn((options, task) => task({ report: vi.fn() }))
    },
    ProgressLocation: {
        Notification: 15
    }
}))

// Mock @finos/calm-shared
vi.mock('@finos/calm-shared', () => ({
    createAuthProvider: vi.fn(),
    createCredentialProvider: vi.fn()
}))

import * as vscode from 'vscode'
import { createAuthProvider, createCredentialProvider } from '@finos/calm-shared'
import { authLoginCommand, authLogoutCommand, authStatusCommand, authRefreshCommand } from './auth-commands'

describe('Auth Commands', () => {
    let mockConfig: Config
    let mockLogger: Logger

    beforeEach(() => {
        vi.clearAllMocks()

        mockConfig = {
            filesGlobs: vi.fn(() => []),
            templateGlobs: vi.fn(() => []),
            previewLayout: vi.fn(() => 'elk'),
            showLabels: vi.fn(() => true),
            urlMapping: vi.fn(() => undefined),
            docifyTheme: vi.fn(() => 'auto'),
            schemaAdditionalFolders: vi.fn(() => []),
            authProvider: vi.fn(() => 'oauth-device-flow'),
            authOptions: vi.fn(() => ({ clientId: 'test-client' })),
            authCredentialStorage: vi.fn(() => 'file'),
            calmHubUrl: vi.fn(() => 'https://calm-hub.example.com')
        }

        mockLogger = {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn()
        }
    })

    describe('authLoginCommand', () => {
        it('should show error when no auth provider configured', async () => {
            mockConfig.authProvider = vi.fn(() => undefined)

            await authLoginCommand(mockConfig, mockLogger)

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('No authentication configured')
            )
        })

        it('should authenticate successfully', async () => {
            const mockAuthProvider = {
                authenticate: vi.fn().mockResolvedValue(undefined)
            }

            vi.mocked(createCredentialProvider).mockReturnValue({} as any)
            vi.mocked(createAuthProvider).mockReturnValue(mockAuthProvider as any)

            await authLoginCommand(mockConfig, mockLogger)

            expect(createAuthProvider).toHaveBeenCalledWith(
                {
                    provider: 'oauth-device-flow',
                    options: { clientId: 'test-client' }
                },
                expect.anything()
            )
            expect(mockAuthProvider.authenticate).toHaveBeenCalled()
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                expect.stringContaining('successful')
            )
        })

        it('should handle authentication errors', async () => {
            const mockAuthProvider = {
                authenticate: vi.fn().mockRejectedValue(new Error('Auth failed'))
            }

            vi.mocked(createCredentialProvider).mockReturnValue({} as any)
            vi.mocked(createAuthProvider).mockReturnValue(mockAuthProvider as any)

            await authLoginCommand(mockConfig, mockLogger)

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('Auth failed')
            )
        })
    })

    describe('authLogoutCommand', () => {
        it('should show message when no auth provider configured', async () => {
            mockConfig.authProvider = vi.fn(() => undefined)

            await authLogoutCommand(mockConfig, mockLogger)

            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                expect.stringContaining('No authentication configured')
            )
        })

        it('should logout successfully', async () => {
            const mockAuthProvider = {
                logout: vi.fn().mockResolvedValue(undefined)
            }

            vi.mocked(createCredentialProvider).mockReturnValue({} as any)
            vi.mocked(createAuthProvider).mockReturnValue(mockAuthProvider as any)

            await authLogoutCommand(mockConfig, mockLogger)

            expect(mockAuthProvider.logout).toHaveBeenCalled()
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                expect.stringContaining('Logged out successfully')
            )
        })
    })

    describe('authStatusCommand', () => {
        it('should show message when no auth provider configured', async () => {
            mockConfig.authProvider = vi.fn(() => undefined)

            await authStatusCommand(mockConfig, mockLogger)

            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                expect.stringContaining('No authentication configured')
            )
        })

        it('should show authenticated status with token', async () => {
            const mockAuthProvider = {
                getStoredToken: vi.fn().mockResolvedValue('test-token')
            }

            vi.mocked(createCredentialProvider).mockReturnValue({} as any)
            vi.mocked(createAuthProvider).mockReturnValue(mockAuthProvider as any)

            await authStatusCommand(mockConfig, mockLogger)

            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                expect.stringContaining('Authenticated')
            )
        })

        it('should show not authenticated status without token', async () => {
            const mockAuthProvider = {
                getStoredToken: vi.fn().mockResolvedValue(null)
            }

            vi.mocked(createCredentialProvider).mockReturnValue({} as any)
            vi.mocked(createAuthProvider).mockReturnValue(mockAuthProvider as any)

            await authStatusCommand(mockConfig, mockLogger)

            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
                expect.stringContaining('Not authenticated')
            )
        })

        it('should decode JWT token expiry', async () => {
            const futureTime = Math.floor(Date.now() / 1000) + 7200 // 2 hours from now
            const payload = Buffer.from(JSON.stringify({ exp: futureTime })).toString('base64')
            const jwtToken = `header.${payload}.signature`

            const mockAuthProvider = {
                getStoredToken: vi.fn().mockResolvedValue(jwtToken)
            }

            vi.mocked(createCredentialProvider).mockReturnValue({} as any)
            vi.mocked(createAuthProvider).mockReturnValue(mockAuthProvider as any)

            await authStatusCommand(mockConfig, mockLogger)

            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                expect.stringMatching(/expires in \d+ hours/)
            )
        })
    })

    describe('authRefreshCommand', () => {
        it('should show error when no auth provider configured', async () => {
            mockConfig.authProvider = vi.fn(() => undefined)

            await authRefreshCommand(mockConfig, mockLogger)

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('No authentication configured')
            )
        })

        it('should refresh token successfully', async () => {
            const mockAuthProvider = {
                refresh: vi.fn().mockResolvedValue(true)
            }

            vi.mocked(createCredentialProvider).mockReturnValue({} as any)
            vi.mocked(createAuthProvider).mockReturnValue(mockAuthProvider as any)

            await authRefreshCommand(mockConfig, mockLogger)

            expect(mockAuthProvider.refresh).toHaveBeenCalled()
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                expect.stringContaining('refreshed successfully')
            )
        })

        it('should show message when token is still valid', async () => {
            const mockAuthProvider = {
                refresh: vi.fn().mockResolvedValue(false)
            }

            vi.mocked(createCredentialProvider).mockReturnValue({} as any)
            vi.mocked(createAuthProvider).mockReturnValue(mockAuthProvider as any)

            await authRefreshCommand(mockConfig, mockLogger)

            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                expect.stringContaining('still valid')
            )
        })
    })
})
