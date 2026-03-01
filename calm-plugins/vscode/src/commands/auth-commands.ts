import * as vscode from 'vscode'
import { createAuthProvider, createCredentialProvider } from '@finos/calm-shared'
import type { Config } from '../core/ports/config'
import type { Logger } from '../core/ports/logger'

/**
 * Handles 'calm.auth.login' command
 * Initiates authentication with the configured provider
 */
export async function authLoginCommand(config: Config, logger: Logger): Promise<void> {
    const authProviderName = config.authProvider()

    if (!authProviderName) {
        void vscode.window.showErrorMessage(
            'No authentication configured. Please configure auth.provider in VSCode settings.'
        )
        return
    }

    try {
        logger.info?.(`[auth] Initiating authentication with provider: ${authProviderName}`)

        const authOptions = config.authOptions() || {}
        const credentialStorageName = config.authCredentialStorage() || 'file'

        const credentialProvider = createCredentialProvider(credentialStorageName)
        const authProvider = createAuthProvider(
            {
                provider: authProviderName,
                options: authOptions
            },
            credentialProvider
        )

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Authenticating...',
            cancellable: false
        }, async (progress) => {
            progress.report({ message: 'Starting authentication flow' })
            await authProvider.authenticate()
        })

        void vscode.window.showInformationMessage('✓ Authentication successful!')
        logger.info?.('[auth] Authentication successful')
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        void vscode.window.showErrorMessage(`Authentication failed: ${message}`)
        logger.error?.(`[auth] Authentication failed: ${message}`)
    }
}

/**
 * Handles 'calm.auth.logout' command
 * Clears stored credentials
 */
export async function authLogoutCommand(config: Config, logger: Logger): Promise<void> {
    const authProviderName = config.authProvider()

    if (!authProviderName) {
        void vscode.window.showInformationMessage('No authentication configured to logout from')
        return
    }

    try {
        logger.info?.(`[auth] Clearing credentials for provider: ${authProviderName}`)

        const authOptions = config.authOptions() || {}
        const credentialStorageName = config.authCredentialStorage() || 'file'

        const credentialProvider = createCredentialProvider(credentialStorageName)
        const authProvider = createAuthProvider(
            {
                provider: authProviderName,
                options: authOptions
            },
            credentialProvider
        )

        await authProvider.logout()

        void vscode.window.showInformationMessage('✓ Logged out successfully')
        logger.info?.('[auth] Logged out successfully')
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        void vscode.window.showErrorMessage(`Logout failed: ${message}`)
        logger.error?.(`[auth] Logout failed: ${message}`)
    }
}

/**
 * Handles 'calm.auth.status' command
 * Shows authentication status
 */
export async function authStatusCommand(config: Config, logger: Logger): Promise<void> {
    const authProviderName = config.authProvider()

    if (!authProviderName) {
        void vscode.window.showInformationMessage('No authentication configured')
        return
    }

    try {
        logger.info?.(`[auth] Checking status for provider: ${authProviderName}`)

        const authOptions = config.authOptions() || {}
        const credentialStorageName = config.authCredentialStorage() || 'file'

        const credentialProvider = createCredentialProvider(credentialStorageName)
        const authProvider = createAuthProvider(
            {
                provider: authProviderName,
                options: authOptions
            },
            credentialProvider
        )

        const token = await authProvider.getStoredToken?.()

        if (token) {
            // Try to decode JWT for expiry info
            let expiryInfo = ''
            try {
                const parts = token.split('.')
                if (parts.length === 3) {
                    const decoded = JSON.parse(Buffer.from(parts[1], 'base64').toString())
                    if (decoded.exp) {
                        const expiry = new Date(decoded.exp * 1000)
                        const now = new Date()
                        if (expiry > now) {
                            const hoursRemaining = Math.round((expiry.getTime() - now.getTime()) / (1000 * 60 * 60))
                            expiryInfo = ` (expires in ${hoursRemaining} hours)`
                        } else {
                            expiryInfo = ' (expired)'
                        }
                    }
                }
            } catch {
                // Not a JWT or can't decode
            }

            void vscode.window.showInformationMessage(
                `✓ Authenticated with ${authProviderName}${expiryInfo}`
            )
            logger.info?.('[auth] Authenticated')
        } else {
            void vscode.window.showWarningMessage(
                `Not authenticated. Run "CALM: Authenticate" to login.`
            )
            logger.info?.('[auth] Not authenticated')
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        void vscode.window.showErrorMessage(`Status check failed: ${message}`)
        logger.error?.(`[auth] Status check failed: ${message}`)
    }
}

/**
 * Handles 'calm.auth.refresh' command
 * Manually refresh authentication token
 */
export async function authRefreshCommand(config: Config, logger: Logger): Promise<void> {
    const authProviderName = config.authProvider()

    if (!authProviderName) {
        void vscode.window.showErrorMessage('No authentication configured')
        return
    }

    try {
        logger.info?.(`[auth] Refreshing token for provider: ${authProviderName}`)

        const authOptions = config.authOptions() || {}
        const credentialStorageName = config.authCredentialStorage() || 'file'

        const credentialProvider = createCredentialProvider(credentialStorageName)
        const authProvider = createAuthProvider(
            {
                provider: authProviderName,
                options: authOptions
            },
            credentialProvider
        )

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Refreshing token...',
            cancellable: false
        }, async () => {
            const refreshed = await authProvider.refresh()
            if (refreshed) {
                void vscode.window.showInformationMessage('✓ Token refreshed successfully')
                logger.info?.('[auth] Token refreshed')
            } else {
                void vscode.window.showInformationMessage('✓ Token is still valid')
                logger.info?.('[auth] Token still valid')
            }
        })
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        void vscode.window.showErrorMessage(`Token refresh failed: ${message}`)
        logger.error?.(`[auth] Token refresh failed: ${message}`)
    }
}
