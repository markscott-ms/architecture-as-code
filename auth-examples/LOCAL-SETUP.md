# Local Development Setup with OAuth

This guide shows how to set up a complete local development environment with CALM CLI/VSCode Extension and OAuth authentication using Keycloak.

## Quick Start (5 minutes)

### 1. Start the Local Stack

```bash
# From the architecture-as-code root
cd auth-examples

# Copy the docker-compose example
cp docker-compose-local.example.yml docker-compose.yml
cp keycloak-realm.example.json keycloak-realm.json

# Start all services
docker-compose up -d

# Wait for services to be healthy
sleep 30
docker-compose ps

# Verify CALM Hub is running
curl http://localhost:3000/health
```

### 2. Configure CALM CLI

```bash
# Create config file with Device Code Flow (best for CLI)
mkdir -p ~/.calm

cat > ~/.calm.json << 'EOF'
{
  "calmHubUrl": "http://localhost:3000",
  "auth": {
    "provider": "oauth-device-flow",
    "options": {
      "deviceAuthorizationEndpoint": "http://localhost:8080/auth/realms/calm/protocol/openid-connect/auth/device",
      "tokenEndpoint": "http://localhost:8080/auth/realms/calm/protocol/openid-connect/token",
      "clientId": "calm-cli",
      "clientSecret": "secret123",
      "scope": "openid profile email"
    }
  }
}
EOF
```

### 3. Test CALM CLI

```bash
# Install or link CLI
npm run link:cli

# Check version
calm --version

# Login with OAuth Device Flow
calm auth login

# You'll see:
# Device Login
# 
# 1. Go to http://localhost:8080/...
# 2. Enter code: XXXXXXXX
#
# Waiting for authorization...

# Follow the prompts in browser, return to terminal

# Check auth status
calm auth status

# Token saved! You're authenticated.
```

### 4. Configure VSCode Extension

In `.vscode/settings.json`:

```json
{
  "calm.calmHubUrl": "http://localhost:3000",
  "calm.auth.provider": "oauth-authcode-flow",
  "calm.auth.options": {
    "authorizationEndpoint": "http://localhost:8080/auth/realms/calm/protocol/openid-connect/auth",
    "tokenEndpoint": "http://localhost:8080/auth/realms/calm/protocol/openid-connect/token",
    "clientId": "calm-vscode",
    "redirectUri": "http://localhost:7622",
    "scope": "openid profile email",
    "openBrowser": true
  },
  "calm.auth.credentialStorage": "file"
}
```

### 5. Test VSCode Extension

```bash
# From calm-plugins/vscode
npm run watch

# Press F5 to debug extension
# Command Palette > CALM: Authenticate
# Browser opens automatically
# Login with test-user / test123
# Extension shows "Authenticated" notification
```

## Creating Additional Users

```bash
# Access Keycloak Admin Console
# http://localhost:8080/auth/admin
# Username: admin
# Password: admin123

# Users > Add User
# Username: architect
# Email: architect@example.com
# Email Verified: ON
# Credentials > Set Password: password123
```

## Testing Different Flows

### Device Code Flow (Recommended for CLI)

Best for:
- Terminal/SSH environments
- CI/CD systems that can't use browser redirect
- Users without GUI

```bash
calm auth login
# Interactive device code prompt
```

### Authorization Code Flow (Recommended for UI)

Best for:
- VSCode extension
- Desktop applications
- User workstations with browser

Automatically opens browser on `calm vscode auth login`

### Bearer Token (For Service Accounts)

Best for:
- CI/CD pipelines
- Headless/automated environments
- Service accounts

```bash
export CALM_SERVICE_TOKEN="eyJhbGc..."
calm validate -a architecture.json -p pattern.json
```

## Troubleshooting

### Port Already in Use

```bash
# Find process on port
lsof -i :8080  # Keycloak
lsof -i :3000  # CALM Hub
lsof -i :5432 # PostgreSQL

# Kill and restart
docker-compose down
docker-compose up -d
```

### Keycloak Not Starting

```bash
# Check logs
docker-compose logs keycloak

# Reset and restart
docker-compose down -v
docker-compose up -d keycloak
docker-compose logs -f keycloak
```

### CALM Hub Can't Connect to MongoDB

```bash
# Check MongoDB is running
docker-compose ps mongo

# View CALM Hub logs
docker-compose logs -f calm-hub

# Restart CALM Hub
docker-compose restart calm-hub
```

### "Invalid redirect URI"

Ensure redirectUri in config matches Keycloak client settings:
- CLI: `http://localhost:7622`
- VSCode: `http://localhost:7622`
- CALM Hub: `http://localhost:3000/*`

### Token Expired

```bash
# Refresh token
calm auth refresh

# Or re-login
calm auth logout
calm auth login
```

## Network Debugging

### Test OAuth Endpoints

```bash
# Device authorization endpoint
curl -X POST http://localhost:8080/auth/realms/calm/protocol/openid-connect/auth/device \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=calm-cli&client_secret=secret123"

# Token endpoint
curl -X POST http://localhost:8080/auth/realms/calm/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=urn:ietf:params:oauth:grant-type:device_code&device_code=ABC123&client_id=calm-cli&client_secret=secret123"
```

### Inspect CALM Hub API

```bash
# Get schemas list
curl http://localhost:3000/api/schemas

# With authentication
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/schemas
```

## Cleanup

```bash
# Stop all services
docker-compose down

# Remove data volumes (full reset)
docker-compose down -v
```

## Next Steps

- [AUTHENTICATION.md](../AUTHENTICATION.md) - Full authentication documentation
- [Keycloak Documentation](https://www.keycloak.org/documentation.html)
- [OAuth 2.0 Device Flow (RFC 8628)](https://tools.ietf.org/html/rfc8628)
- [OAuth 2.0 PKCE (RFC 7636)](https://tools.ietf.org/html/rfc7636)
