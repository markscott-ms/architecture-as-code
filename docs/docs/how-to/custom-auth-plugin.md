---
id: custom-auth-plugin
title: Write a Custom Authentication Plugin
sidebar_position: 3
---

# Write a Custom Authentication Plugin

Learn how to implement custom authentication providers for the CALM CLI and VSCode Extension to support enterprise-specific authentication mechanisms.

## Overview

The CALM authentication system is extensible, allowing you to implement custom authentication providers for:
- Legacy authentication systems (NTLM, Kerberos direct)
- Custom enterprise SSO solutions
- Hardware security modules (HSM)
- Certificate-based authentication
- Custom token formats
- API gateway integration

## Architecture

The authentication system uses a plugin architecture with two main interfaces:

```
┌─────────────────────┐
│   CLI / VSCode      │
│   Extension         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   AuthProvider      │  ← Your custom implementation
│   Interface         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  CredentialProvider │
│  Interface          │
└─────────────────────┘
```

## Prerequisites

- Node.js 22+ 
- TypeScript knowledge
- Understanding of your authentication mechanism
- CALM shared library (`@finos/calm-shared`)

## Step 1: Understand the Interfaces

### AuthProvider Interface

Located in `shared/src/auth/auth-provider.ts`:

```typescript
export interface AuthProvider {
    /**
     * Initiate authentication flow
     * @returns Promise that resolves when authentication completes
     */
    authenticate(): Promise<void>

    /**
     * Get authentication headers to add to HTTP requests
     * @returns Headers object with authentication data
     */
    getAuthHeaders(): Promise<Record<string, string>>

    /**
     * Check if currently authenticated
     * @returns true if authenticated, false otherwise
     */
    isAuthenticated(): Promise<boolean>

    /**
     * Refresh expired or expiring token
     * @returns Promise that resolves when token refreshed
     */
    refresh(): Promise<void>

    /**
     * Clear stored credentials and logout
     * @returns Promise that resolves when logout completes
     */
    logout(): Promise<void>
}
```

### CredentialProvider Interface

```typescript
export interface CredentialProvider {
    /**
     * Store a credential
     * @param key - Unique identifier for credential
     * @param value - Credential data (will be JSON stringified)
     */
    store(key: string, value: unknown): Promise<void>

    /**
     * Retrieve a credential
     * @param key - Unique identifier for credential
     * @returns Credential data or null if not found
     */
    retrieve(key: string): Promise<unknown | null>

    /**
     * Delete a specific credential
     * @param key - Unique identifier for credential
     */
    delete(key: string): Promise<void>

    /**
     * Clear all stored credentials
     */
    clear(): Promise<void>
}
```

## Step 2: Create Your Provider

### Example: Certificate-Based Authentication

Let's implement a custom provider that uses client certificates:

```typescript
// shared/src/auth/providers/certificate-provider.ts

import { AuthProvider } from '../auth-provider'
import { CredentialProvider } from '../credential-provider'
import { readFileSync } from 'fs'
import { Agent } from 'https'

interface CertificateAuthConfig {
    certPath: string       // Path to client certificate
    keyPath: string        // Path to private key
    passphrase?: string    // Optional key passphrase
    caPath?: string        // Optional CA certificate path
}

export class CertificateAuthProvider implements AuthProvider {
    private agent: Agent | null = null
    private config: CertificateAuthConfig

    constructor(
        config: Record<string, unknown>,
        private credentialProvider: CredentialProvider
    ) {
        // Validate configuration
        if (!config.certPath || typeof config.certPath !== 'string') {
            throw new Error('certPath is required')
        }
        if (!config.keyPath || typeof config.keyPath !== 'string') {
            throw new Error('keyPath is required')
        }

        this.config = config as CertificateAuthConfig
    }

    async authenticate(): Promise<void> {
        console.log('Setting up certificate authentication...')

        // Read certificate and key files
        const cert = readFileSync(this.config.certPath, 'utf8')
        const key = readFileSync(this.config.keyPath, 'utf8')
        const ca = this.config.caPath 
            ? readFileSync(this.config.caPath, 'utf8') 
            : undefined

        // Create HTTPS agent with client certificate
        this.agent = new Agent({
            cert,
            key,
            passphrase: this.config.passphrase,
            ca,
            rejectUnauthorized: true
        })

        // Store agent configuration for later use
        await this.credentialProvider.store('certificate-auth', {
            certPath: this.config.certPath,
            keyPath: this.config.keyPath,
            configuredAt: new Date().toISOString()
        })

        console.log('✓ Certificate authentication configured')
    }

    async getAuthHeaders(): Promise<Record<string, string>> {
        // Certificate auth is handled at TLS level, not HTTP headers
        // But we can add custom headers if needed
        return {
            'X-Auth-Method': 'certificate'
        }
    }

    async isAuthenticated(): Promise<boolean> {
        const stored = await this.credentialProvider.retrieve('certificate-auth')
        return stored !== null && this.agent !== null
    }

    async refresh(): Promise<void> {
        // Re-read certificates in case they were rotated
        await this.authenticate()
    }

    async logout(): Promise<void> {
        this.agent = null
        await this.credentialProvider.delete('certificate-auth')
        console.log('✓ Certificate authentication cleared')
    }

    /**
     * Get the configured HTTPS agent for axios
     * This should be used when creating HTTP clients
     */
    getAgent(): Agent | null {
        return this.agent
    }
}
```

### Example: Custom Token API

Here's a provider that calls a custom enterprise API to get tokens:

```typescript
// shared/src/auth/providers/custom-token-provider.ts

import { AuthProvider } from '../auth-provider'
import { CredentialProvider } from '../credential-provider'
import axios from 'axios'

interface CustomTokenConfig {
    tokenApiUrl: string
    apiKey: string
    username?: string
}

interface TokenResponse {
    token: string
    expiresIn: number
}

export class CustomTokenProvider implements AuthProvider {
    private token: string | null = null
    private expiresAt: Date | null = null

    constructor(
        private config: Record<string, unknown>,
        private credentialProvider: CredentialProvider
    ) {
        if (!config.tokenApiUrl || typeof config.tokenApiUrl !== 'string') {
            throw new Error('tokenApiUrl is required')
        }
        if (!config.apiKey || typeof config.apiKey !== 'string') {
            throw new Error('apiKey is required')
        }
    }

    async authenticate(): Promise<void> {
        console.log('Fetching token from custom API...')

        const { tokenApiUrl, apiKey, username } = this.config as CustomTokenConfig

        try {
            // Call your custom token API
            const response = await axios.post<TokenResponse>(
                tokenApiUrl,
                { username: username || process.env.USER },
                {
                    headers: {
                        'X-API-Key': apiKey,
                        'Content-Type': 'application/json'
                    }
                }
            )

            this.token = response.data.token
            this.expiresAt = new Date(Date.now() + response.data.expiresIn * 1000)

            // Store token securely
            await this.credentialProvider.store('custom-token', {
                token: this.token,
                expiresAt: this.expiresAt.toISOString()
            })

            console.log('✓ Token obtained successfully')
        } catch (error) {
            throw new Error(`Failed to authenticate: ${error}`)
        }
    }

    async getAuthHeaders(): Promise<Record<string, string>> {
        if (!this.token) {
            // Try to load from credential store
            const stored = await this.credentialProvider.retrieve('custom-token')
            if (stored && typeof stored === 'object' && 'token' in stored) {
                this.token = (stored as { token: string }).token
                this.expiresAt = new Date((stored as { expiresAt: string }).expiresAt)
            }
        }

        if (!this.token) {
            throw new Error('Not authenticated. Call authenticate() first.')
        }

        // Check if token expired
        if (this.expiresAt && this.expiresAt < new Date()) {
            await this.refresh()
        }

        return {
            'Authorization': `Bearer ${this.token}`
        }
    }

    async isAuthenticated(): Promise<boolean> {
        const stored = await this.credentialProvider.retrieve('custom-token')
        if (!stored) return false

        // Check if token expired
        if (typeof stored === 'object' && 'expiresAt' in stored) {
            const expiresAt = new Date((stored as { expiresAt: string }).expiresAt)
            return expiresAt > new Date()
        }

        return false
    }

    async refresh(): Promise<void> {
        // Get new token
        await this.authenticate()
    }

    async logout(): Promise<void> {
        this.token = null
        this.expiresAt = null
        await this.credentialProvider.delete('custom-token')
        console.log('✓ Logged out successfully')
    }
}
```

## Step 3: Register Your Provider

### Option A: In Your Local Project

Create a registration file:

```typescript
// my-project/auth-setup.ts

import { registerAuthProvider } from '@finos/calm-shared'
import { CertificateAuthProvider } from './certificate-provider'
import { CustomTokenProvider } from './custom-token-provider'

// Register your custom providers
registerAuthProvider('certificate-auth', (config, credStore) => 
    new CertificateAuthProvider(config, credStore)
)

registerAuthProvider('custom-token', (config, credStore) => 
    new CustomTokenProvider(config, credStore)
)

console.log('Custom auth providers registered')
```

Import this before using the CLI or loading the extension.

### Option B: As npm Package

Create an npm package for your provider:

```json
{
  "name": "@mycompany/calm-auth-certificate",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "peerDependencies": {
    "@finos/calm-shared": "^0.2.2"
  }
}
```

```typescript
// src/index.ts
export { CertificateAuthProvider } from './certificate-provider'

import { registerAuthProvider } from '@finos/calm-shared'
import { CertificateAuthProvider } from './certificate-provider'

// Auto-register on import
registerAuthProvider('certificate-auth', (config, credStore) => 
    new CertificateAuthProvider(config, credStore)
)
```

Users can install and use:

```bash
npm install @mycompany/calm-auth-certificate
```

```typescript
// Import to register
import '@mycompany/calm-auth-certificate'
```

## Step 4: Configure and Use

### CLI Configuration

Update `~/.calm.json`:

```json
{
  "calmHubUrl": "https://calm-hub.example.com",
  "auth": {
    "provider": "certificate-auth",
    "options": {
      "certPath": "/path/to/client-cert.pem",
      "keyPath": "/path/to/client-key.pem",
      "passphrase": "${CERT_PASSPHRASE}",
      "caPath": "/path/to/ca-cert.pem"
    }
  }
}
```

### VSCode Configuration

Update `.vscode/settings.json`:

```json
{
  "calm.calmHubUrl": "https://calm-hub.example.com",
  "calm.auth.provider": "custom-token",
  "calm.auth.options": {
    "tokenApiUrl": "https://auth.example.com/api/token",
    "apiKey": "${API_KEY}",
    "username": "myuser"
  }
}
```

## Step 5: Test Your Provider

Create unit tests:

```typescript
// certificate-provider.spec.ts

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CertificateAuthProvider } from './certificate-provider'
import { MemoryCredentialProvider } from '@finos/calm-shared'

describe('CertificateAuthProvider', () => {
    let provider: CertificateAuthProvider
    let credStore: MemoryCredentialProvider

    beforeEach(() => {
        credStore = new MemoryCredentialProvider()
    })

    it('should require certPath', () => {
        expect(() => {
            new CertificateAuthProvider({}, credStore)
        }).toThrow('certPath is required')
    })

    it('should require keyPath', () => {
        expect(() => {
            new CertificateAuthProvider({ certPath: '/path' }, credStore)
        }).toThrow('keyPath is required')
    })

    it('should authenticate successfully', async () => {
        provider = new CertificateAuthProvider(
            {
                certPath: './test-fixtures/cert.pem',
                keyPath: './test-fixtures/key.pem'
            },
            credStore
        )

        await provider.authenticate()
        expect(await provider.isAuthenticated()).toBe(true)
    })

    it('should return auth headers', async () => {
        provider = new CertificateAuthProvider(
            {
                certPath: './test-fixtures/cert.pem',
                keyPath: './test-fixtures/key.pem'
            },
            credStore
        )

        await provider.authenticate()
        const headers = await provider.getAuthHeaders()
        
        expect(headers).toHaveProperty('X-Auth-Method', 'certificate')
    })

    it('should logout successfully', async () => {
        provider = new CertificateAuthProvider(
            {
                certPath: './test-fixtures/cert.pem',
                keyPath: './test-fixtures/key.pem'
            },
            credStore
        )

        await provider.authenticate()
        expect(await provider.isAuthenticated()).toBe(true)

        await provider.logout()
        expect(await provider.isAuthenticated()).toBe(false)
    })
})
```

## Advanced Patterns

### Interactive Authentication

For providers requiring user input:

```typescript
import * as readline from 'readline'

async authenticate(): Promise<void> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    })

    const username = await new Promise<string>(resolve => {
        rl.question('Username: ', resolve)
    })

    const password = await new Promise<string>(resolve => {
        rl.question('Password: ', (answer) => {
            resolve(answer)
            rl.close()
        })
    })

    // Use credentials to authenticate
    // ...
}
```

### Token Caching

Implement smart caching to avoid unnecessary authentication:

```typescript
async getAuthHeaders(): Promise<Record<string, string>> {
    // Check cache first
    const cached = await this.credentialProvider.retrieve('cached-token')
    
    if (cached) {
        const { token, expiresAt } = cached as { token: string, expiresAt: string }
        
        // Return cached if not expired
        if (new Date(expiresAt) > new Date()) {
            return { 'Authorization': `Bearer ${token}` }
        }
    }

    // Cache miss or expired - refresh
    await this.refresh()
    return this.getAuthHeaders()
}
```

### Async Initialization

For providers requiring async setup:

```typescript
export class AsyncAuthProvider implements AuthProvider {
    private initialized = false
    private initPromise: Promise<void> | null = null

    private async initialize(): Promise<void> {
        if (this.initialized) return
        if (this.initPromise) return this.initPromise

        this.initPromise = (async () => {
            // Async initialization logic
            await this.loadConfiguration()
            await this.setupConnections()
            this.initialized = true
        })()

        return this.initPromise
    }

    async authenticate(): Promise<void> {
        await this.initialize()
        // ... rest of authentication
    }

    async getAuthHeaders(): Promise<Record<string, string>> {
        await this.initialize()
        // ... get headers
    }
}
```

## Integration with Document Loaders

If you need custom HTTP agent configuration (e.g., for certificates), extend your provider:

```typescript
export interface CustomHttpAgent {
    getAgent(): Agent | null
}

export class CertificateAuthProvider 
    implements AuthProvider, CustomHttpAgent {
    
    getAgent(): Agent | null {
        return this.agent
    }
}
```

Then document loader can use:

```typescript
if ('getAgent' in authProvider) {
    const agent = (authProvider as CustomHttpAgent).getAgent()
    axiosConfig.httpsAgent = agent
}
```

## Best Practices

1. **Validate configuration early** - Check all required config in constructor
2. **Handle errors gracefully** - Provide clear error messages
3. **Store credentials securely** - Always use CredentialProvider
4. **Support refresh** - Implement token refresh when possible
5. **Test thoroughly** - Write unit and integration tests
6. **Document configuration** - Provide clear examples
7. **Environment variables** - Support `${ENV_VAR}` syntax for secrets
8. **Logging** - Use console.log for user feedback, avoid logging secrets

## Troubleshooting

### "Provider not found"

**Solution:** Ensure provider is registered before use:
```typescript
import './auth-setup'  // Registers providers
```

### Configuration not loading

**Solution:** Check config validation in constructor throws descriptive errors.

### Credentials not persisting

**Solution:** Ensure you're calling `credentialProvider.store()` after authentication.

## Example: Complete SAML Provider

See [auth-examples on GitHub](https://github.com/finos/architecture-as-code/tree/main/auth-examples) for complete authentication provider examples.

## Next Steps

- [Authenticate CLI with CALM Hub](cli-authentication.md) - Use built-in providers
- [Authenticate VSCode Extension](vscode-authentication.md) - Configure VSCode
- [Complete Authentication Reference](https://github.com/finos/architecture-as-code/blob/main/AUTHENTICATION.md) - Full documentation on GitHub

## See Also

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Node.js https module](https://nodejs.org/api/https.html)
- [axios documentation](https://axios-http.com/docs/intro)
- [CALM Shared Library on GitHub](https://github.com/finos/architecture-as-code/tree/main/shared)
