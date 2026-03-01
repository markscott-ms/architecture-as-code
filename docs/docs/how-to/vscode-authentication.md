---
id: vscode-authentication
title: Authenticate VSCode Extension with CALM Hub
sidebar_position: 2
---

# Authenticate VSCode Extension with CALM Hub

Learn how to configure and authenticate the CALM VSCode Extension to connect securely to a CALM Hub instance.

## Overview

The CALM VSCode Extension supports OAuth 2.0 authentication for connecting to CALM Hub, enabling:
- Validation of architectures against remote patterns
- Loading remote architecture files
- Secure communication with enterprise CALM Hub instances

**Recommended authentication method:** OAuth Authorization Code Flow with PKCE (automatically opens browser for authentication)

## Prerequisites

- VSCode 1.88.0 or later
- CALM VSCode Extension installed
- Access to a CALM Hub instance
- OAuth client credentials from your identity provider

## Quick Start

### 1. Open VSCode Settings

**Option A:** Via Command Palette
1. Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (macOS)
2. Type "Preferences: Open Settings (JSON)"
3. Select either User or Workspace settings

**Option B:** Via Settings UI
1. Go to File > Preferences > Settings (or Code > Preferences > Settings on macOS)
2. Search for "CALM"
3. Configure settings using the UI

### 2. Configure CALM Hub URL

Add to your `settings.json`:

```json
{
  "calm.calmHubUrl": "https://calm-hub.example.com"
}
```

### 3. Configure Authentication Provider

```json
{
  "calm.calmHubUrl": "https://calm-hub.example.com",
  "calm.auth.provider": "oauth-authcode-flow",
  "calm.auth.options": {
    "authorizationEndpoint": "https://auth.example.com/oauth/authorize",
    "tokenEndpoint": "https://auth.example.com/oauth/token",
    "clientId": "calm-vscode-client",
    "redirectUri": "http://localhost:7622",
    "scope": "openid profile email offline_access",
    "openBrowser": true
  },
  "calm.auth.credentialStorage": "file"
}
```

### 4. Authenticate

**Via Command Palette:**
1. Press `Ctrl+Shift+P` / `Cmd+Shift+P`
2. Type "CALM: Authenticate"
3. Press Enter

Your browser will automatically open to the authentication page.

**What happens:**
1. Extension starts a temporary local HTTP server on port 7622
2. Browser opens to your IdP's authorization page
3. You sign in with your credentials
4. Browser redirects back to `http://localhost:7622` with authorization code
5. Extension exchanges code for access token
6. Token is stored securely

### 5. Verify Authentication

**Via Command Palette:**
1. Press `Ctrl+Shift+P` / `Cmd+Shift+P`
2. Type "CALM: Authentication Status"
3. Press Enter

You'll see a notification showing:
```
✓ Authenticated
Provider: oauth-authcode-flow
Expires: 2026-03-01T15:30:00Z
```

## Configuration Options

### Authentication Providers

The extension supports three authentication providers:

#### 1. OAuth Authorization Code Flow (Recommended for VSCode)

**Best for:** Desktop applications with browser access

```json
{
  "calm.auth.provider": "oauth-authcode-flow",
  "calm.auth.options": {
    "authorizationEndpoint": "https://auth.example.com/oauth/authorize",
    "tokenEndpoint": "https://auth.example.com/oauth/token",
    "clientId": "calm-vscode",
    "redirectUri": "http://localhost:7622",
    "scope": "openid profile email offline_access",
    "openBrowser": true
  }
}
```

**Options:**
- `authorizationEndpoint` - OAuth authorization URL
- `tokenEndpoint` - OAuth token exchange URL
- `clientId` - OAuth client ID for VSCode extension
- `redirectUri` - Callback URL (default: `http://localhost:7622`)
- `scope` - OAuth scopes to request
- `openBrowser` - Auto-open browser (default: `true`)

#### 2. OAuth Device Code Flow

**Best for:** Remote development environments or SSH sessions

```json
{
  "calm.auth.provider": "oauth-device-flow",
  "calm.auth.options": {
    "deviceAuthorizationEndpoint": "https://auth.example.com/oauth/device/code",
    "tokenEndpoint": "https://auth.example.com/oauth/token",
    "clientId": "calm-vscode",
    "scope": "openid profile email",
    "pollInterval": 5000
  }
}
```

This displays a device code in VSCode that you manually enter at the authentication URL.

#### 3. Bearer Token

**Best for:** Pre-obtained tokens or API keys

```json
{
  "calm.auth.provider": "bearer-token",
  "calm.auth.options": {
    "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "calm.auth.credentialStorage": "memory"
}
```

Or use environment variables:

```json
{
  "calm.auth.provider": "bearer-token",
  "calm.auth.options": {
    "token": "${CALM_TOKEN}"
  }
}
```

### Credential Storage

Control how credentials are stored:

```json
{
  "calm.auth.credentialStorage": "file"  // or "memory"
}
```

- **`file`** (default) - Stores credentials in `~/.calm/credentials/` with 0600 permissions
- **`memory`** - In-memory only, lost when VSCode closes

## Provider-Specific Examples

### Okta Configuration

```json
{
  "calm.calmHubUrl": "https://calm-hub.example.com",
  "calm.auth.provider": "oauth-authcode-flow",
  "calm.auth.options": {
    "authorizationEndpoint": "https://company.okta.com/oauth2/v1/authorize",
    "tokenEndpoint": "https://company.okta.com/oauth2/v1/token",
    "clientId": "0oa1c5t7k9m2n3p4",
    "redirectUri": "http://localhost:7622",
    "scope": "openid profile email offline_access"
  }
}
```

### Azure AD Configuration

```json
{
  "calm.calmHubUrl": "https://calm-hub.example.com",
  "calm.auth.provider": "oauth-authcode-flow",
  "calm.auth.options": {
    "authorizationEndpoint": "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    "tokenEndpoint": "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    "clientId": "550e8400-e29b-41d4-a716-446655440000",
    "redirectUri": "http://localhost:7622",
    "scope": "https://api.calm.finos.org/.default offline_access"
  }
}
```

### Keycloak Configuration

```json
{
  "calm.calmHubUrl": "https://calm-hub.example.com",
  "calm.auth.provider": "oauth-authcode-flow",
  "calm.auth.options": {
    "authorizationEndpoint": "https://keycloak.example.com/auth/realms/calm/protocol/openid-connect/auth",
    "tokenEndpoint": "https://keycloak.example.com/auth/realms/calm/protocol/openid-connect/token",
    "clientId": "calm-vscode",
    "redirectUri": "http://localhost:7622",
    "scope": "openid profile email"
  }
}
```

## Using Authentication Commands

The extension provides four authentication commands via Command Palette:

### CALM: Authenticate

Initiates authentication flow. Opens browser automatically (Authorization Code Flow) or displays device code (Device Flow).

**Keyboard Shortcut:** None (use Command Palette)

### CALM: Authentication Status

Shows current authentication status including:
- Provider type
- Token expiration time
- Remaining validity period

### CALM: Refresh Authentication

Manually refreshes the access token using the refresh token.

**When to use:**
- Token is about to expire
- You receive 401 errors

### CALM: Logout

Clears stored credentials.

**When to use:**
- Switching accounts
- Troubleshooting authentication issues
- Ending work session

## Workspace vs User Settings

### User Settings

Configuration in User settings applies to **all workspaces**:

```json
// settings.json (User)
{
  "calm.calmHubUrl": "https://calm-hub.example.com",
  "calm.auth.provider": "oauth-authcode-flow",
  "calm.auth.options": { /* ... */ }
}
```

### Workspace Settings

Configuration in `.vscode/settings.json` applies to **current workspace only**:

```json
// .vscode/settings.json
{
  "calm.calmHubUrl": "https://calm-hub-dev.example.com",
  "calm.auth.provider": "oauth-authcode-flow",
  "calm.auth.options": { /* ... */ }
}
```

**Best Practice:** Use workspace settings for project-specific CALM Hub URLs, user settings for personal authentication.

## Multi-Environment Setup

Configure different CALM Hub instances per workspace:

**Development Workspace:**
```json
// my-project/.vscode/settings.json
{
  "calm.calmHubUrl": "https://calm-hub-dev.example.com"
}
```

**Production Workspace:**
```json
// my-project-prod/.vscode/settings.json
{
  "calm.calmHubUrl": "https://calm-hub-prod.example.com"
}
```

Authentication is shared across workspaces (stored in `~/.calm/credentials/`), but each workspace can target a different CALM Hub instance.

## Troubleshooting

### "Authentication failed: No provider configured"

**Solution:** Ensure `calm.auth.provider` is set in settings:
```json
{
  "calm.auth.provider": "oauth-authcode-flow"
}
```

### Browser doesn't open automatically

**Solution:** 
1. Check `openBrowser` is `true`:
   ```json
   {
     "calm.auth.options": {
       "openBrowser": true
     }
   }
   ```
2. Manually open the authorization URL shown in VSCode notification

### "Port 7622 already in use"

**Solution:** 
1. Close other applications using port 7622
2. Or change redirect URI to use a different port:
   ```json
   {
     "calm.auth.options": {
       "redirectUri": "http://localhost:8080"
     }
   }
   ```

### "Invalid redirect URI"

**Solution:** Ensure `redirectUri` in settings matches the redirect URI registered in your OAuth client:
- VSCode setting: `"redirectUri": "http://localhost:7622"`
- OAuth client config: Must include `http://localhost:7622` in allowed redirect URIs

### Token expired errors

**Solution:**
1. Run "CALM: Refresh Authentication" command
2. Or run "CALM: Authenticate" to re-authenticate

### Remote development (WSL, SSH, Containers)

**Issue:** Browser redirect might not work in remote environments.

**Solution:** Use Device Code Flow instead:
```json
{
  "calm.auth.provider": "oauth-device-flow"
}
```

## Security Best Practices

1. **Use workspace settings** for project configs, avoid committing credentials
2. **Add to .gitignore:** 
   ```gitignore
   .vscode/settings.json  # If it contains auth options
   ```
3. **Use file storage** for persistent authentication across sessions
4. **Rotate tokens** according to your organization's security policy
5. **Logout when done** in shared environments

## Example: Complete Setup

Here's a complete example for enterprise Okta authentication:

**File:** `.vscode/settings.json` (workspace-specific)

```json
{
  "calm.calmHubUrl": "https://calm-hub.corp.example.com",
  "calm.auth.provider": "oauth-authcode-flow",
  "calm.auth.options": {
    "authorizationEndpoint": "https://corp.okta.com/oauth2/v1/authorize",
    "tokenEndpoint": "https://corp.okta.com/oauth2/v1/token",
    "clientId": "0oa1c5t7k9m2n3p4",
    "redirectUri": "http://localhost:7622",
    "scope": "openid profile email offline_access",
    "openBrowser": true
  },
  "calm.auth.credentialStorage": "file"
}
```

**Steps:**
1. Save settings file
2. Open Command Palette (`Ctrl+Shift+P`)
3. Run "CALM: Authenticate"
4. Browser opens to Okta login
5. Sign in with corporate credentials
6. Extension receives token
7. Start working with CALM Hub

## Next Steps

- [Authenticate CLI with CALM Hub](cli-authentication.md) - Configure CLI authentication
- [Write Custom Authentication Plugin](custom-auth-plugin.md) - Implement custom authentication
- [Complete Authentication Reference](https://github.com/finos/architecture-as-code/blob/main/AUTHENTICATION.md) - Full documentation on GitHub

## See Also

- [OAuth 2.0 Authorization Code Flow (RFC 7636)](https://tools.ietf.org/html/rfc7636)
- [PKCE Extension](https://tools.ietf.org/html/rfc7636)
- [VSCode Extension on GitHub](https://github.com/finos/architecture-as-code/tree/main/calm-plugins/vscode)
