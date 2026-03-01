# CALM Authentication Guide

This guide explains how to configure authentication for the CALM CLI and VSCode Extension to access protected CALM Hub instances and remote CALM architectures.

## Overview

The CALM authentication system supports three OAuth 2.0 flows plus bearer token authentication:

1. **Device Code Flow (RFC 8628)** - Best for CLI, headless environments, and SSH sessions
2. **Authorization Code Flow with PKCE (RFC 7636)** - Best for desktop applications and VSCode
3. **Bearer Token** - For CI/CD pipelines, API keys, and pre-obtained tokens

All providers support automatic token refresh, credential storage, and enterprise OIDC/Kerberos scenarios.

## Configuration

### CLI Configuration (`~/.calm.json`)

Create or edit `~/.calm.json` in your home directory:

```json
{
  "calmHubUrl": "https://calm-hub.enterprise.com",
  "auth": {
    "provider": "oauth-device-flow",
    "options": {
      "deviceAuthorizationEndpoint": "https://auth.enterprise.com/oauth/device/code",
      "tokenEndpoint": "https://auth.enterprise.com/oauth/token",
      "clientId": "calm-cli"
    },
    "credentialStorage": "file"
  }
}
```

The config file is optional. If not present, you'll be prompted to authenticate on first use.

### VSCode Configuration

Open VSCode Settings (`Ctrl+,` or `Cmd+,`) and search for "CALM" to configure:

```json
{
  "calm.calmHubUrl": "https://calm-hub.enterprise.com",
  "calm.auth.provider": "oauth-device-flow",
  "calm.auth.options": {
    "deviceAuthorizationEndpoint": "https://auth.enterprise.com/oauth/device/code",
    "tokenEndpoint": "https://auth.enterprise.com/oauth/token",
    "clientId": "calm-vscode"
  },
  "calm.auth.credentialStorage": "file"
}
```

Or in `.vscode/settings.json` for workspace-specific settings.

## Authentication Providers

### Device Code Flow (Recommended for CLI)

Best for headless environments where browser access is not available.

**Configuration:**
```json
{
  "auth": {
    "provider": "oauth-device-flow",
    "options": {
      "deviceAuthorizationEndpoint": "https://auth.example.com/oauth/device/code",
      "tokenEndpoint": "https://auth.example.com/oauth/token",
      "clientId": "calm-cli",
      "clientSecret": "optional-client-secret",
      "scope": "openid profile email"
    }
  }
}
```

**Usage:**
```bash
$ calm auth login
Device code: EXAMPLE-CODE-123
User code: EXAM
Verification URL: https://auth.example.com/device?user_code=EXAM

Open the above URL in your browser and enter the code to authenticate.
✓ Authentication successful!
```

**Flow:**
1. Device requests device code and verification URL
2. User opens URL in browser and enters device code
3. CLI polls token endpoint until user completes authentication
4. Token automatically stored for future requests

### Authorization Code Flow (Recommended for VSCode)

Best for desktop applications with browser support.

**Configuration:**
```json
{
  "auth": {
    "provider": "oauth-authcode-flow",
    "options": {
      "authorizationEndpoint": "https://auth.example.com/oauth/authorize",
      "tokenEndpoint": "https://auth.example.com/oauth/token",
      "clientId": "calm-vscode",
      "redirectUri": "http://localhost:7622",
      "scope": "openid profile email"
    }
  }
}
```

**Features:**
- Implements RFC 7636 PKCE for security
- Dynamically allocates localhost port for callback
- Auto-opens browser for authentication
- Stores refresh token for token renewal
- User-friendly flow with automatic browser handling

**Usage (VSCode):**
1. Run `CALM: Authenticate` from Command Palette
2. Browser opens automatically
3. User logs in with enterprise credentials
4. Token stored and automatically used for subsequent requests

### Bearer Token (For CI/CD and Pre-obtained Tokens)

Best for API keys, CI/CD pipelines, and service accounts.

**Configuration:**
```json
{
  "auth": {
    "provider": "bearer-token",
    "options": {
      "token": "${CALM_AUTH_TOKEN}"
    }
  }
}
```

**Features:**
- Support for environment variable substitution (${VAR_NAME})
- Static tokens or dynamic environment variables
- Optional credential store persistence
- Ideal for CI/CD systems

**Usage:**
```bash
# Via environment variable
export CALM_AUTH_TOKEN="eyJhbGciOiJIUzI1NiIs..."
calm validate -a my-architecture.json

# Via static config (not recommended for production)
# Use environment variable instead for security
```

## CLI Commands

### Authenticate

Initiate authentication with the configured provider:

```bash
calm auth login [--provider <name>]
```

**Options:**
- `--provider <name>` - Override the default provider from config
- `-v, --verbose` - Enable verbose logging

**Example:**
```bash
# Use config provider (Device Flow in this example)
$ calm auth login
Device code: EXAMPLE-CODE-123
✓ Authentication successful!

# Override to use Bearer Token provider
$ calm auth login --provider bearer-token
✓ Authentication successful!
```

### Check Authentication Status

Display current authentication status and token information:

```bash
calm auth status
```

**Output:**
```
✓ Authenticated
  Provider: oauth-device-flow
  Token available: yes
  Expires in: 2 hours
```

### Logout

Clear stored credentials:

```bash
calm auth logout
```

### Refresh Token

Manually refresh authentication token:

```bash
calm auth refresh
```

**Output:**
```
✓ Token refreshed successfully
```

## VSCode Commands

All authentication commands are available in the Command Palette (`Ctrl+Shift+P`):

- **CALM: Authenticate** - Initialize authentication flow
- **CALM: Authentication Status** - Show current status with token details
- **CALM: Logout** - Clear stored credentials  
- **CALM: Refresh Authentication** - Manually refresh token

## Enterprise Configuration Examples

### OIDC Provider (e.g., Okta, Azure AD, Keycloak)

```json
{
  "calmHubUrl": "https://calm-adc.enterprise.com",
  "auth": {
    "provider": "oauth-device-flow",
    "options": {
      "deviceAuthorizationEndpoint": "https://auth.enterprise.com/oauth/v2/device/authorize",
      "tokenEndpoint": "https://auth.enterprise.com/oauth/v2/token",
      "clientId": "calm-cli",
      "scope": "openid profile email"
    }
  }
}
```

### Kerberos / SPNEGO (Managed by Enterprise ADC)

```json
{
  "calmHubUrl": "https://calm-adc.enterprise.com",
  "auth": {
    "provider": "oauth-authcode-flow",
    "options": {
      "authorizationEndpoint": "https://calm-adc.enterprise.com/oauth/authorize",
      "tokenEndpoint": "https://calm-adc.enterprise.com/oauth/token",
      "clientId": "calm-client",
      "redirectUri": "http://localhost:7622"
    }
  }
}
```

The enterprise ADC (Authorization, Authentication & Delegation Controller) handles Kerberos/SPNEGO negotiation transparently.

### CI/CD with Service Account

```json
{
  "calmHubUrl": "https://calm-adc.enterprise.com",
  "auth": {
    "provider": "bearer-token",
    "options": {
      "token": "${CI_CALM_TOKEN}"
    }
  }
}
```

In your CI pipeline:
```bash
export CI_CALM_TOKEN="eyJhb...token..."
calm validate -a architecture.json
```

## Credential Storage

Authentication credentials are stored securely depending on the configured provider:

### File Storage (Default)

```json
{
  "auth": {
    "credentialStorage": "file"
  }
}
```

- Stores tokens in `~/.calm/credentials/` directory
- File permissions: mode 0600 (read-write for owner only)
- Location: `~/.calm/credentials/{provider}-token.json`
- Supports both access and refresh tokens
- Automatically used for token refresh

### Memory Storage

```json
{
  "auth": {
    "credentialStorage": "memory"
  }
}
```

- Tokens stored in process memory only
- Tokens lost when process exits
- More secure for short-lived scripts
- Requires re-authentication after process restart

### Enterprise Vault Integration

To integrate with enterprise credential vaults (HashiCorp Vault, AWS Secrets Manager, etc.):

1. Implement custom `CredentialProvider` interface extending `@finos/calm-shared`
2. Configure via plugin system (see [AGENTS.md](../AGENTS.md) for plugin details)
3. Example vault provider in enterprise repo

## Troubleshooting

### "No authentication configured"

**Issue:** `Error: No authentication configured`

**Solution:**
1. Create or update `~/.calm.json` with auth config
2. Or use `calm auth login --provider <name>` to specify provider

```bash
mkdir -p ~/.calm
cat > ~/.calm.json << 'EOF'
{
  "calmHubUrl": "https://calm-hub.example.com",
  "auth": {
    "provider": "oauth-device-flow",
    "options": {
      "deviceAuthorizationEndpoint": "https://auth.example.com/oauth/device/code",
      "tokenEndpoint": "https://auth.example.com/oauth/token",
      "clientId": "calm-cli"
    }
  }
}
EOF
```

### "Authentication failed: Request failed with status code 401"

**Issue:** Token is invalid or expired

**Solution:**
1. Check token status: `calm auth status`
2. Refresh token: `calm auth refresh`
3. Re-authenticate: `calm auth login`

```bash
# Check status
$ calm auth status
✗ Not authenticated

# Login again
$ calm auth login
```

### "CALM Hub URL not accessible"

**Issue:** `Error: connect ECONNREFUSED 192.168.1.1:443`

**Solution:**
1. Verify CALM Hub is running and accessible
2. Check network connectivity and firewall rules
3. Verify SSL certificates if using self-signed certs
4. Check calmHubUrl in config is correct

```bash
# Verify connectivity
curl -i https://calm-hub.example.com

# Test with verbose logging
calm validate --verbose -a architecture.json
```

### "Token refresh failed"

**Issue:** `Error: Refresh token expired`

**Solution:**
- Re-authenticate with fresh credentials:
  ```bash
  calm auth login
  ```

### "Environment variable not found"

**Issue:** `Error: Environment variable TOKEN_VAR not found`

**Solution for bearer-token:**
Set the environment variable before running:

```bash
export CALM_TOKEN="your-token-here"
calm validate -a architecture.json
```

Or update config to reference correct variable name.

## Advanced: Custom Authentication Providers

To implement custom authentication for enterprise systems:

1. **Implement `AuthProvider` interface** from `@finos/calm-shared`
   - Implement `authenticate()`, `refresh()`, `logout()`, `getAuthHeaders()`, `getStoredToken()`

2. **Register with plugin system**
   - Use `registerAuthProvider()` in extension or via config

3. **Example: SAML2 Provider**
   ```typescript
   import { AuthProvider, CredentialProvider } from '@finos/calm-shared'
   
   export class SAMLAuthProvider implements AuthProvider {
       async authenticate(): Promise<void> {
           // SAML flow implementation
       }
       async getAuthHeaders(): Promise<Record<string, string>> {
           // Return Authorization header
       }
       // ... implement other methods
   }
   ```

4. **Register in CLI config**
   ```json
   {
     "auth": {
       "provider": "saml",
       "options": { "idp": "https://idp.enterprise.com" }
     }
   }
   ```

See [shared/AGENTS.md](../shared/AGENTS.md) for full plugin system documentation.

## Security Considerations

1. **Never commit credentials** to version control
2. **Use environment variables** for CI/CD tokens
3. **Restrict file permissions** - credentials stored with 0600 mode
4. **Use HTTPS** - all authentication endpoints should use HTTPS
5. **Rotate tokens regularly** - Follow your enterprise security policy
6. **Use refresh tokens** - Prefer device/authcode flow with automatic refresh over static tokens
7. **Enable PKCE** - AuthCode Flow includes automatic PKCE for XSS protection

## See Also

- [CLI README](../cli/README.md) - CLI usage guide
- [VSCode Extension README](../calm-plugins/vscode/README.md) - Extension guide
- [CALM Hub README](../calm-hub/README.md) - Backend configuration
- [OAuth 2.0 Device Code Flow (RFC 8628)](https://datatracker.ietf.org/doc/html/rfc8628)
- [OAuth 2.0 PKCE (RFC 7636)](https://datatracker.ietf.org/doc/html/rfc7636)
