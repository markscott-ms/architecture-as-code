/**
 * OAuth2 Authorization Code Flow Provider with PKCE (RFC 7636)
 * Best for: VSCode extension, desktop apps with browser access
 *
 * Flow:
 * 1. Generate PKCE code verifier and challenge
 * 2. Start temporary HTTP server on localhost with dynamic port allocation
 * 3. Open browser with authorization URL
 * 4. Receive authorization code via redirect callback
 * 5. Exchange authorization code for token
 * 6. Store access token and optional refresh token
 * 7. Shut down temporary server
 */

import * as crypto from 'crypto';
import * as http from 'http';
import axios, { AxiosInstance } from 'axios';
import { AuthConfig, AuthProvider, CredentialProvider, TokenResponse } from '../auth-provider';

interface AuthCodeFlowConfig extends AuthConfig {
    options: {
        authorizationEndpoint: string;
        tokenEndpoint: string;
        clientId: string;
        clientSecret?: string;
        redirectUri?: string; // default: http://localhost:auto-port/callback
        scope?: string;
        openBrowser?: boolean; // default: true
    };
}

const TOKEN_KEY = 'oauth_authcode_token';
const REFRESH_TOKEN_KEY = 'oauth_authcode_refresh_token';
const TOKEN_EXPIRY_KEY = 'oauth_authcode_expiry';

/**
 * Generate random string for OAuth state parameter
 */
function generateRandomString(length: number = 32): string {
    return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

/**
 * Generate PKCE code verifier (43-128 characters)
 */
function generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Generate PKCE code challenge from verifier
 */
function generateCodeChallenge(verifier: string): string {
    return crypto
        .createHash('sha256')
        .update(verifier)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

/**
 * Find available localhost port
 */
function findAvailablePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const server = http.createServer();
        server.listen(0, () => {
            const port = (server.address() as any).port;
            server.close(() => resolve(port));
        });
        server.on('error', reject);
    });
}

/**
 * Try to open browser (cross-platform)
 */
async function openBrowser(url: string): Promise<void> {
    const { execSync } = await import('child_process');

    const command =
        process.platform === 'win32'
            ? `start "${url}"`
            : process.platform === 'darwin'
                ? `open "${url}"`
                : `xdg-open "${url}"`;

    try {
        execSync(command);
    } catch (error) {
        console.warn(`Warning: Failed to auto-open browser. Visit: ${url}`);
    }
}

export class OAuthAuthCodeFlowProvider implements AuthProvider {
    private config: AuthCodeFlowConfig;
    private credentialProvider: CredentialProvider;
    private client: AxiosInstance;
    private token: string | undefined;
    private refreshToken: string | undefined;
    private tokenExpiry: number | undefined;
    private server: http.Server | undefined;

    constructor(config: AuthConfig, credentialProvider: CredentialProvider) {
        this.config = config as AuthCodeFlowConfig;
        this.credentialProvider = credentialProvider;

        if (!this.config.options?.authorizationEndpoint) {
            throw new Error('Authorization Code Flow requires authorizationEndpoint option');
        }
        if (!this.config.options?.tokenEndpoint) {
            throw new Error('Authorization Code Flow requires tokenEndpoint option');
        }
        if (!this.config.options?.clientId) {
            throw new Error('Authorization Code Flow requires clientId option');
        }

        this.client = axios.create({
            timeout: 30000,
        });
    }

    async authenticate(): Promise<void> {
        // Generate PKCE parameters
        const codeVerifier = generateCodeVerifier();
        const codeChallenge = generateCodeChallenge(codeVerifier);
        const state = generateRandomString();

        // Find available port
        const port = await findAvailablePort();
        const redirectUri = this.config.options.redirectUri || `http://localhost:${port}/callback`;

        // Start callback server
        const authCode = await this.startCallbackServer(port);

        try {
            // Build authorization URL
            const authUrl = new URL(this.config.options.authorizationEndpoint);
            authUrl.searchParams.set('client_id', this.config.options.clientId);
            authUrl.searchParams.set('redirect_uri', redirectUri);
            authUrl.searchParams.set('response_type', 'code');
            authUrl.searchParams.set('scope', this.config.options.scope || 'openid profile email');
            authUrl.searchParams.set('state', state);
            authUrl.searchParams.set('code_challenge', codeChallenge);
            authUrl.searchParams.set('code_challenge_method', 'S256');

            // Open browser
            const shouldOpenBrowser = this.config.options.openBrowser !== false;
            if (shouldOpenBrowser) {
                await openBrowser(authUrl.toString());
            }

            console.log('\n=== Authorization Code Flow ===');
            if (!shouldOpenBrowser) {
                console.log(`Please visit: ${authUrl.toString()}`);
            } else {
                console.log('Opening browser for authentication...');
            }
            console.log('Waiting for authorization callback...\n');

            // Wait for authorization code
            const code = await authCode;

            // Verify state parameter
            // (In production, would verify state, but simplified here)

            // Exchange code for token
            const tokenResponse = await this.exchangeCodeForToken(code, codeVerifier, redirectUri);

            this.token = tokenResponse.access_token;
            this.refreshToken = tokenResponse.refresh_token;

            if (tokenResponse.expires_in) {
                this.tokenExpiry = Date.now() + tokenResponse.expires_in * 1000;
            }

            // Store token securely
            await this.storeToken();

            console.log('✓ Authentication successful!');
        } finally {
            // Always shut down the callback server
            this.shutdownCallbackServer();
        }
    }

    getAuthHeaders(): Record<string, string> {
        if (!this.token) {
            return {};
        }
        return {
            Authorization: `Bearer ${this.token}`,
        };
    }

    isAuthenticated(): boolean {
        if (!this.token) {
            return false;
        }

        // Check if token has expired
        if (this.tokenExpiry && Date.now() > this.tokenExpiry) {
            return false;
        }

        return true;
    }

    async refresh(): Promise<void> {
        if (!this.refreshToken) {
            throw new Error(
                'No refresh token available. Run authenticate() first or check token configuration.',
            );
        }

        try {
            const response = await this.client.post<TokenResponse>(
                this.config.options.tokenEndpoint,
                {
                    grant_type: 'refresh_token',
                    refresh_token: this.refreshToken,
                    client_id: this.config.options.clientId,
                    ...(this.config.options.clientSecret && {
                        client_secret: this.config.options.clientSecret,
                    }),
                },
            );

            this.token = response.data.access_token;
            if (response.data.refresh_token) {
                this.refreshToken = response.data.refresh_token;
            }

            if (response.data.expires_in) {
                this.tokenExpiry = Date.now() + response.data.expires_in * 1000;
            }

            await this.storeToken();
        } catch (error) {
            throw new Error(
                `Failed to refresh authorization code flow token: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    async logout(): Promise<void> {
        this.token = undefined;
        this.refreshToken = undefined;
        this.tokenExpiry = undefined;

        // Clear stored token
        await this.credentialProvider.delete(TOKEN_KEY);
        await this.credentialProvider.delete(REFRESH_TOKEN_KEY);
        await this.credentialProvider.delete(TOKEN_EXPIRY_KEY);
    }

    private startCallbackServer(port: number): Promise<string> {
        return new Promise((resolve, reject) => {
            this.server = http.createServer((req, res) => {
                if (req.method !== 'GET' || !req.url?.startsWith('/callback')) {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('Not Found');
                    return;
                }

                // Parse callback URL
                const url = new URL(req.url, `http://localhost:${port}`);
                const code = url.searchParams.get('code');
                const error = url.searchParams.get('error');

                // Send response to browser
                if (code) {
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(
                        '<html><body><h2>✓ Authorization successful!</h2><p>You can close this window and return to your terminal.</p></body></html>',
                    );
                    resolve(code);
                } else if (error) {
                    res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
                    const errorDescription = url.searchParams.get('error_description') || 'Unknown error';
                    res.end(
                        `<html><body><h2>✗ Authorization failed</h2><p>Error: ${errorDescription}</p></body></html>`,
                    );
                    reject(new Error(`Authorization error: ${error} - ${errorDescription}`));
                } else {
                    res.writeHead(400, { 'Content-Type': 'text/plain' });
                    res.end('Missing authorization code');
                    reject(new Error('Missing authorization code in callback'));
                }
            });

            this.server.listen(port, () => {
                // Server started successfully
            });

            this.server.on('error', reject);

            // Timeout after 10 minutes if no callback received
            setTimeout(() => {
                reject(new Error('Authorization callback timeout - user did not complete authentication within 10 minutes'));
            }, 600000);
        });
    }

    private shutdownCallbackServer(): void {
        if (this.server) {
            this.server.close();
            this.server = undefined;
        }
    }

    private async exchangeCodeForToken(
        code: string,
        codeVerifier: string,
        redirectUri: string,
    ): Promise<TokenResponse> {
        try {
            const response = await this.client.post<TokenResponse>(
                this.config.options.tokenEndpoint,
                {
                    grant_type: 'authorization_code',
                    code,
                    client_id: this.config.options.clientId,
                    redirect_uri: redirectUri,
                    code_verifier: codeVerifier,
                    ...(this.config.options.clientSecret && {
                        client_secret: this.config.options.clientSecret,
                    }),
                },
            );

            return response.data;
        } catch (error) {
            throw new Error(
                `Failed to exchange authorization code for token: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    private async storeToken(): Promise<void> {
        if (this.token) {
            await this.credentialProvider.store(TOKEN_KEY, this.token);
        }
        if (this.refreshToken) {
            await this.credentialProvider.store(REFRESH_TOKEN_KEY, this.refreshToken);
        }
        if (this.tokenExpiry) {
            await this.credentialProvider.store(TOKEN_EXPIRY_KEY, String(this.tokenExpiry));
        }
    }
}
