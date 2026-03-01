import { initLogger } from '@finos/calm-shared';
import { loadAuthProvider, loadCredentialProvider } from '../cli-config';
import { loadCliConfig } from '../cli-config';

const logger = initLogger(false, 'calm-cli:auth');

/**
 * Handles 'calm auth login' command
 * Initiates authentication with the configured provider
 */
export async function handleAuthLogin(providerName?: string, verbose?: boolean): Promise<void> {
    const debug = !!verbose;
    const logger = initLogger(debug, 'calm-cli:auth:login');

    try {
        const config = await loadCliConfig();
        if (!config?.auth) {
            throw new Error('No authentication configured. Add auth block to ~/.calm.json');
        }

        // Allow override of provider from command line
        const selectedProvider = providerName || config.auth.provider;

        logger.info(`Initiating authentication with provider: ${selectedProvider}`);

        // Load credential provider for storage
        const credentialProvider = loadCredentialProvider(config);

        // Create auth provider
        const authConfig = {
            ...config.auth,
            provider: selectedProvider,
        };

        const { createAuthProvider } = await import('@finos/calm-shared');
        const authProvider = createAuthProvider(authConfig, credentialProvider);

        // Authenticate
        logger.info('Starting authentication flow...');
        await authProvider.authenticate();

        console.log('✓ Authentication successful!');
        const token = await authProvider.getStoredToken?.();
        if (token) {
            console.log(`✓ Token stored and will be used for subsequent requests`);
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`✗ Authentication failed: ${message}`);
        process.exit(1);
    }
}

/**
 * Handles 'calm auth logout' command
 * Clears stored credentials
 */
export async function handleAuthLogout(verbose?: boolean): Promise<void> {
    const debug = !!verbose;
    const logger = initLogger(debug, 'calm-cli:auth:logout');

    try {
        const config = await loadCliConfig();
        if (!config?.auth) {
            console.log('No credentials to logout from');
            return;
        }

        logger.info(`Clearing credentials for provider: ${config.auth.provider}`);

        // Load credential provider
        const credentialProvider = loadCredentialProvider(config);

        // Load auth provider
        const authProvider = loadAuthProvider(config);
        if (!authProvider) {
            throw new Error('No auth provider configured');
        }

        // Call logout
        await authProvider.logout();

        console.log('✓ Logged out successfully');
        logger.info('Credentials cleared');
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`✗ Logout failed: ${message}`);
        process.exit(1);
    }
}

/**
 * Handles 'calm auth status' command
 * Shows authentication status and token information
 */
export async function handleAuthStatus(verbose?: boolean): Promise<void> {
    const debug = !!verbose;
    const logger = initLogger(debug, 'calm-cli:auth:status');

    try {
        const config = await loadCliConfig();
        if (!config?.auth) {
            console.log('No authentication configured');
            return;
        }

        logger.info(`Checking status for provider: ${config.auth.provider}`);

        // Load auth provider
        const authProvider = loadAuthProvider(config);
        if (!authProvider) {
            console.log('No auth provider configured');
            return;
        }

        // Try to get stored token
        const token = await authProvider.getStoredToken?.();

        if (token) {
            console.log('✓ Authenticated');
            console.log(`  Provider: ${config.auth.provider}`);
            console.log(`  Token available: yes`);

            // Try to determine token expiry if it's a JWT
            try {
                const parts = token.split('.');
                if (parts.length === 3) {
                    const decoded = JSON.parse(Buffer.from(parts[1], 'base64').toString());
                    if (decoded.exp) {
                        const expiry = new Date(decoded.exp * 1000);
                        const now = new Date();
                        if (expiry > now) {
                            const hoursRemaining = Math.round((expiry.getTime() - now.getTime()) / (1000 * 60 * 60));
                            console.log(`  Expires in: ${hoursRemaining} hours`);
                        } else {
                            console.log(`  Status: Token expired`);
                        }
                    }
                }
            } catch (e) {
                // Not a JWT or can't decode, that's ok
                logger.debug('Token does not appear to be JWT');
            }
        } else {
            console.log('✗ Not authenticated');
            console.log(`  Provider: ${config.auth.provider}`);
            console.log(`  Run: calm auth login`);
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`✗ Status check failed: ${message}`);
        process.exit(1);
    }
}

/**
 * Handles 'calm auth refresh' command
 * Manually refresh authentication token
 */
export async function handleAuthRefresh(verbose?: boolean): Promise<void> {
    const debug = !!verbose;
    const logger = initLogger(debug, 'calm-cli:auth:refresh');

    try {
        const config = await loadCliConfig();
        if (!config?.auth) {
            throw new Error('No authentication configured');
        }

        logger.info(`Refreshing token for provider: ${config.auth.provider}`);

        // Load auth provider
        const authProvider = loadAuthProvider(config);
        if (!authProvider) {
            throw new Error('No auth provider configured');
        }

        // Refresh token
        console.log('Refreshing token...');
        const refreshed = await authProvider.refresh();

        if (refreshed) {
            console.log('✓ Token refreshed successfully');
        } else {
            console.log('✓ Token is still valid');
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`✗ Token refresh failed: ${message}`);
        process.exit(1);
    }
}
