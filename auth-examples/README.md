# Authentication Configuration Examples

This directory contains example configurations for different authentication scenarios.

## Quick Start Examples

### Example 1: Local Development (No Auth)

```json
{
  "calmHubUrl": "http://localhost:3000"
}
```

### Example 2: Device Code Flow (CLI - Recommended)

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
    }
  }
}
```

### Example 3: Authorization Code Flow (VSCode - Recommended)

```json
{
  "calmHubUrl": "https://calm-hub.example.com",
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

### Example 4: Bearer Token (CI/CD)

```json
{
  "calmHubUrl": "https://calm-hub.example.com",
  "auth": {
    "provider": "bearer-token",
    "options": {
      "token": "${CALM_TOKEN}"
    }
  }
}
```

## Enterprise Scenarios

### Okta OIDC

```json
{
  "calmHubUrl": "https://calm-hub.corp.example.com",
  "auth": {
    "provider": "oauth-device-flow",
    "options": {
      "deviceAuthorizationEndpoint": "https://corp.okta.com/oauth2/v1/device_authorization",
      "tokenEndpoint": "https://corp.okta.com/oauth2/v1/token",
      "clientId": "0oa1234567890",
      "scope": "openid profile email offline_access"
    }
  }
}
```

### Azure AD

```json
{
  "calmHubUrl": "https://calm-hub.corp.example.com",
  "auth": {
    "provider": "oauth-authcode-flow",
    "options": {
      "authorizationEndpoint": "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
      "tokenEndpoint": "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      "clientId": "550e8400-e29b-41d4-a716-446655440000",
      "redirectUri": "http://localhost:7622",
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
      "clientSecret": "secret123",
      "scope": "openid profile email"
    }
  }
}
```

### SAML2 via ADC Bridge

When using a CALM ADC (Authorization, Delegation & Compliance Controller) that bridges SAML2:

```json
{
  "calmHubUrl": "https://calm-adc.corp.example.com",
  "auth": {
    "provider": "oauth-authcode-flow",
    "options": {
      "authorizationEndpoint": "https://calm-adc.corp.example.com/oauth/authorize",
      "tokenEndpoint": "https://calm-adc.corp.example.com/oauth/token",
      "clientId": "calm-client",
      "redirectUri": "http://localhost:7622"
    }
  }
}
```

The ADC transparently handles SAML2 negotiation with your enterprise identity provider.

## CI/CD Examples

### GitHub Actions

```yaml
name: Validate CALM

on: [push]

env:
  CALM_TOKEN: ${{ secrets.CALM_TOKEN }}
  CALM_HUB_URL: https://calm-hub.corp.example.com

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '22'
      
      - name: Install CALM CLI
        run: npm install -g @finos/calm-cli
      
      - name: Create CALM config
        run: |
          mkdir -p ~/.calm
          cat > ~/.calm.json << 'EOF'
          {
            "calmHubUrl": "${{ env.CALM_HUB_URL }}",
            "auth": {
              "provider": "bearer-token",
              "options": {
                "token": "${{ env.CALM_TOKEN }}"
              }
            }
          }
          EOF
      
      - name: Validate architecture
        run: calm validate -a architecture.json -p pattern.json
```

### GitLab CI

```yaml
validate_calm:
  image: node:22
  script:
    - npm install -g @finos/calm-cli
    - mkdir -p ~/.calm
    - cat > ~/.calm.json << 'EOF'
{
  "calmHubUrl": "$CALM_HUB_URL",
  "auth": {
    "provider": "bearer-token",
    "options": {
      "token": "$CALM_TOKEN"
    }
  }
}
EOF
    - calm validate -a architecture.json -p pattern.json
  variables:
    CALM_HUB_URL: https://calm-hub.corp.example.com
    CALM_TOKEN: $CALM_TOKEN  # Set in CI/CD variables
```

### Jenkins

```groovy
pipeline {
    agent any
    environment {
        CALM_TOKEN = credentials('calm-token')
    }
    stages {
        stage('Setup') {
            steps {
                sh '''
                    npm install -g @finos/calm-cli
                    mkdir -p ~/.calm
                    cat > ~/.calm.json << EOF
{
  "calmHubUrl": "https://calm-hub.corp.example.com",
  "auth": {
    "provider": "bearer-token",
    "options": {
      "token": "${CALM_TOKEN}"
    }
  }
}
EOF
                '''
            }
        }
        stage('Validate') {
            steps {
                sh 'calm validate -a architecture.json -p pattern.json'
            }
        }
    }
}
```

## Local Testing

### Mock CALM Hub with OAuth

For local development, you can use a mock OAuth provider:

```json
{
  "calmHubUrl": "http://localhost:3000",
  "auth": {
    "provider": "oauth-device-flow",
    "options": {
      "deviceAuthorizationEndpoint": "http://localhost:8080/oauth/device/code",
      "tokenEndpoint": "http://localhost:8080/oauth/token",
      "clientId": "calm-local-dev"
    }
  }
}
```

Start a local mock server (optional):

```bash
# Using simple-oauth2-mock or similar
npm install -g simple-oauth2-mock
simple-oauth2-mock --device-grant
```

## File Locations

- **CLI Config**: `~/.calm.json` (Unix/Linux/macOS) or `%USERPROFILE%\.calm\config.json` (Windows)
- **Credentials**: `~/.calm/credentials/` (Unix/Linux/macOS)
- **VSCode Settings**: `.vscode/settings.json` or User Settings

## Troubleshooting

See [AUTHENTICATION.md](../AUTHENTICATION.md) for detailed troubleshooting guide.

## See Also

- [AUTHENTICATION.md](../AUTHENTICATION.md) - Complete authentication documentation
- [CLI README](../cli/README.md) - CLI usage
- [VSCode Extension README](../calm-plugins/vscode/README.md) - Extension usage
