---
id: cli-authentication
title: Authenticate CLI with CALM Hub
sidebar_position: 1
---

# Authenticate CALM CLI with CALM Hub

Learn how to configure and authenticate the CALM CLI to connect securely to a CALM Hub instance using OAuth 2.0 authentication.

## Overview

The CALM CLI supports multiple authentication methods for connecting to CALM Hub:
- **OAuth Device Code Flow** (recommended for CLI) - Interactive browser-based authentication
- **Authorization Code Flow with PKCE** - Alternative browser authentication with callback
- **Bearer Token** - API keys or pre-obtained tokens for CI/CD environments

## Prerequisites

- CALM CLI installed (`npm install -g @finos/calm-cli`)
- Access to a CALM Hub instance
- OAuth client credentials from your identity provider (Okta, Azure AD, Keycloak, etc.)

## Configuration File

Authentication is configured in `~/.calm.json` (Linux/macOS) or `%USERPROFILE%\.calm\config.json` (Windows).

### Basic Structure

```json
{
  "calmHubUrl": "https://calm-hub.example.com",
  "auth": {
    "provider": "oauth-device-flow",
    "options": {
      "deviceAuthorizationEndpoint": "https://auth.example.com/oauth/device/code",
      "tokenEndpoint": "https://auth.example.com/oauth/token",
      "clientId": "calm-cli",
      "scope": "openid profile email"
    },
    "credentialStorage": "file"
  }
}
```

## Step-by-Step: OAuth Device Code Flow

This is the **recommended method for CLI** as it works well in terminal environments.

### 1. Create Configuration File

Create or edit `~/.calm.json`:

```json
{
  "calmHubUrl": "https://calm-hub.example.com",
  "auth": {
    "provider": "oauth-device-flow",
    "options": {
      "deviceAuthorizationEndpoint": "https://auth.example.com/oauth/device/code",
      "tokenEndpoint": "https://auth.example.com/oauth/token",
      "clientId": "calm-cli-client",
      "clientSecret": "optional-client-secret",
      "scope": "openid profile email offline_access",
      "pollInterval": 5000,
      "maxWaitTime": 600000
    }
  }
}
```

**Configuration Options:**
- `deviceAuthorizationEndpoint` - OAuth device authorization URL
- `tokenEndpoint` - OAuth token exchange URL
- `clientId` - OAuth client ID for your application
- `clientSecret` - (Optional) Client secret if required by your IdP
- `scope` - OAuth scopes to request (include `offline_access` for refresh tokens)
- `pollInterval` - Polling interval in milliseconds (default: 5000)
- `maxWaitTime` - Maximum time to wait for authentication in milliseconds (default: 600000)

### 2. Authenticate

Run the authentication command:

```bash
calm auth login
```

You'll see output like:

```
Device Login

1. Go to https://auth.example.com/device
2. Enter code: ABCD-EFGH

Waiting for authorization...
```

### 3. Complete Authentication in Browser

1. Open the URL shown in your browser
2. Enter the device code
3. Sign in with your credentials
4. Approve the application

### 4. Verify Authentication

The CLI will automatically detect successful authentication:

```
✓ Authentication successful!
Token stored securely.
```

Check your authentication status:

```bash
calm auth status
```

Output:

```
Authentication Status: Authenticated
Provider: oauth-device-flow
Token expires: 2026-03-01T15:30:00Z (in 59 minutes)
```

### 5. Use Authenticated Commands

Now you can use CALM Hub commands:

```bash
# Validate against remote patterns
calm validate -a architecture.json -p pattern.json

# Generate architecture from remote pattern
calm generate -p https://calm-hub.example.com/patterns/microservices
```

The CLI automatically includes authentication headers in all requests.

## Alternative: Bearer Token (CI/CD)

For automated environments like CI/CD pipelines, use bearer tokens:

### 1. Create Configuration

```json
{
  "calmHubUrl": "https://calm-hub.example.com",
  "auth": {
    "provider": "bearer-token",
    "options": {
      "token": "${CALM_TOKEN}"
    },
    "credentialStorage": "memory"
  }
}
```

### 2. Set Environment Variable

```bash
export CALM_TOKEN="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 3. Run Commands

```bash
calm validate -a architecture.json -p pattern.json
```

The token is read from the environment variable at runtime.

## Provider-Specific Examples

### Okta

```json
{
  "calmHubUrl": "https://calm-hub.example.com",
  "auth": {
    "provider": "oauth-device-flow",
    "options": {
      "deviceAuthorizationEndpoint": "https://company.okta.com/oauth2/v1/device_authorization",
      "tokenEndpoint": "https://company.okta.com/oauth2/v1/token",
      "clientId": "0oa1c5t7k9m2n3p4",
      "scope": "openid profile email offline_access"
    }
  }
}
```

### Azure AD

```json
{
  "calmHubUrl": "https://calm-hub.example.com",
  "auth": {
    "provider": "oauth-device-flow",
    "options": {
      "deviceAuthorizationEndpoint": "https://login.microsoftonline.com/common/oauth2/v2.0/devicecode",
      "tokenEndpoint": "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      "clientId": "550e8400-e29b-41d4-a716-446655440000",
      "scope": "https://api.calm.finos.org/.default offline_access"
    }
  }
}
```

### Keycloak

```json
{
  "calmHubUrl": "https://calm-hub.example.com",
  "auth": {
    "provider": "oauth-device-flow",
    "options": {
      "deviceAuthorizationEndpoint": "https://keycloak.example.com/auth/realms/calm/protocol/openid-connect/auth/device",
      "tokenEndpoint": "https://keycloak.example.com/auth/realms/calm/protocol/openid-connect/token",
      "clientId": "calm-cli",
      "clientSecret": "your-client-secret",
      "scope": "openid profile email"
    }
  }
}
```

## Managing Authentication

### Check Status

```bash
calm auth status
```

Shows current authentication state and token expiry.

### Refresh Token

```bash
calm auth refresh
```

Manually refresh an expired or expiring token.

### Logout

```bash
calm auth logout
```

Removes stored credentials.

## Credential Storage

Credentials are stored securely:

- **File mode** (default): `~/.calm/credentials/` with 0600 permissions (owner read/write only)
- **Memory mode**: In-memory only, lost when CLI exits

Configure storage in your config:

```json
{
  "auth": {
    "credentialStorage": "file"  // or "memory"
  }
}
```

## Troubleshooting

### "No authentication configured"

**Solution:** Check that `~/.calm.json` exists and has valid `auth` configuration.

### "Authentication failed: 401"

**Solution:** 
1. Run `calm auth login` to re-authenticate
2. Verify your OAuth client credentials are correct
3. Check token hasn't expired with `calm auth status`

### "CALM Hub URL not accessible"

**Solution:**
1. Verify `calmHubUrl` in config is correct
2. Check network connectivity to CALM Hub
3. Ensure CALM Hub is running

### "Token refresh failed"

**Solution:**
1. Re-authenticate with `calm auth login`
2. Ensure `offline_access` scope is included for refresh tokens

### Environment variable not found

**Solution:** When using `${ENV_VAR}` syntax, ensure the environment variable is set before running commands:

```bash
echo $CALM_TOKEN  # Should print your token
```

## Security Best Practices

1. **Never commit credentials** - Add `~/.calm.json` to `.gitignore` if you store it in a repository
2. **Use file storage** - Credentials stored with 0600 permissions prevent unauthorized access
3. **Rotate tokens regularly** - Use your IdP's token rotation policies
4. **Use narrow scopes** - Request only the OAuth scopes you need
5. **Secure CI/CD tokens** - Use secret management (GitHub Secrets, Azure Key Vault, etc.)

## Next Steps

- [Authenticate VSCode Extension](vscode-authentication.md) - Set up authentication in VSCode
- [Write Custom Authentication Plugin](custom-auth-plugin.md) - Implement custom authentication
- [Complete Authentication Reference](https://github.com/finos/architecture-as-code/blob/main/AUTHENTICATION.md) - Full documentation on GitHub

## See Also

- [OAuth 2.0 Device Flow (RFC 8628)](https://tools.ietf.org/html/rfc8628)
- [OAuth 2.0 PKCE (RFC 7636)](https://tools.ietf.org/html/rfc7636)
- [CALM CLI on GitHub](https://github.com/finos/architecture-as-code/tree/main/cli)
