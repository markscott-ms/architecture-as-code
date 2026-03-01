import { initLogger } from '@finos/calm-shared';
import {
    type AuthProvider,
    type CredentialProvider,
    createAuthProvider,
    createCredentialProvider,
} from '@finos/calm-shared';
import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';

/**
 * CLI Configuration for CALM
 *
 * Example configurations:
 *
 * 1. Device Flow (best for CLI/headless):
 * {
 *   "calmHubUrl": "https://calm-adc.enterprise.com",
 *   "auth": {
 *     "provider": "oauth-device-flow",
 *     "options": {
 *       "deviceAuthorizationEndpoint": "https://calm-adc.enterprise.com/oauth/device/code",
 *       "tokenEndpoint": "https://calm-adc.enterprise.com/oauth/token",
 *       "clientId": "calm-cli"
 *     }
 *   }
 * }
 *
 * 2. Authorization Code Flow (better UX):
 * {
 *   "calmHubUrl": "https://calm-adc.enterprise.com",
 *   "auth": {
 *     "provider": "oauth-authcode-flow",
 *     "options": {
 *       "authorizationEndpoint": "https://calm-adc.enterprise.com/oauth/authorize",
 *       "tokenEndpoint": "https://calm-adc.enterprise.com/oauth/token",
 *       "clientId": "calm-cli"
 *     }
 *   }
 * }
 *
 * 3. Bearer Token (for CI/CD):
 * {
 *   "calmHubUrl": "https://calm-adc.enterprise.com",
 *   "auth": {
 *     "provider": "bearer-token",
 *     "options": {
 *       "token": "${CALM_AUTH_TOKEN}"
 *     }
 *   }
 * }
 *
 * 4. Custom provider:
 * {
 *   "calmHubUrl": "https://calm-adc.enterprise.com",
 *   "auth": {
 *     "provider": "my-custom-auth",
 *     "options": {
 *       "customOption": "custom-value"
 *     }
 *   }
 * }
 */
export interface CLIConfig {
    calmHubUrl?: string;
    auth?: {
        provider: string;
        options?: Record<string, unknown>;
        credentialStorage?: string; // Default: 'file', can be 'memory' or custom provider name
    };
}

function getUserConfigLocation(): string {
    const homeDir = homedir();
    return join(homeDir, '.calm.json');
}

export async function loadCliConfig(): Promise<CLIConfig | null> {
    const logger = initLogger(false, 'calm-cli');

    const configFilePath = getUserConfigLocation();
    try {
        const config = await readFile(configFilePath, 'utf8');
        const parsed = JSON.parse(config) as CLIConfig;
        logger.debug('Parsed user config: ' + config);
        return parsed;
    }
    catch (err) {
        if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
            logger.debug('No config file found at ' + configFilePath);
            return null;
        }
        logger.error('Unexpected error loading user config: ' + String(err));
        return null;
    }
}

export function loadCredentialProvider(config: CLIConfig): CredentialProvider {
    const storageName = config.auth?.credentialStorage || 'file';
    return createCredentialProvider(storageName);
}

export function loadAuthProvider(config: CLIConfig): AuthProvider | null {
    if (!config.auth) {
        return null;
    }

    const credentialProvider = loadCredentialProvider(config);
    return createAuthProvider(config.auth, credentialProvider);
}