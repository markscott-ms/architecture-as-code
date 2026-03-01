# Shared Logic Module

This module provides shared logic such as validation and visualization utilities, intended for use across various plugins and tools in the codebase. It simplifies code reuse and promotes a unified logic layer, making it easier to maintain and extend.

## Authentication

The shared module provides extensible authentication support for integrating with CALM Hub and other services. It includes:

- **OAuth 2.0 Device Code Flow** (RFC 8628) - Best for CLI and headless environments
- **OAuth 2.0 Authorization Code Flow with PKCE** (RFC 7636) - Best for desktop and web applications
- **Bearer Token** - For API keys, CI/CD, and service accounts
- **Credential Storage** - File-based (0600 mode), in-memory, and enterprise vault support

### Quick Links

- **[AUTHENTICATION.md](/AUTHENTICATION.md)** - Complete authentication documentation
- **[auth-examples/README.md](/auth-examples/README.md)** - Configuration examples for different scenarios
- **[auth-examples/LOCAL-SETUP.md](/auth-examples/LOCAL-SETUP.md)** - Local development with OAuth

### Example: CLI Authentication

```bash
# Create config with OAuth Device Flow
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

# Authenticate
calm auth login

# Use authenticated commands
calm validate -a architecture.json -p pattern.json
```

### Example: VSCode Extension

In `.vscode/settings.json`:

```json
{
  "calm.calmHubUrl": "https://calm-hub.example.com",
  "calm.auth.provider": "oauth-authcode-flow",
  "calm.auth.options": {
    "authorizationEndpoint": "https://auth.example.com/oauth/authorize",
    "tokenEndpoint": "https://auth.example.com/oauth/token",
    "clientId": "calm-vscode"
  }
}
```

Then use Command Palette: `CALM: Authenticate`

### Enterprise Integration

The authentication system supports enterprise scenarios:

- **OIDC Providers** - Okta, Azure AD, Keycloak
- **Kerberos/SPNEGO** - Via CALM ADC bridge
- **SAML2** - Via CALM ADC bridge
- **CI/CD** - GitHub Actions, GitLab CI, Jenkins, Azure Pipelines

See [auth-examples/](./auth-examples/) for complete enterprise configuration examples.



# Spectral validation rules for CALM implementations

`As of November 2024 - Spectral rules are bundled into shared and converted into typescript representation. `

These rules perform simple structural checks on CALM implementation files to verify that they make sense semantically.
For example, if a relationship references a node, then that node should exist in the file.

## Running Spectral Rulesets Manually
**Prerequisites**: You need `npm` on your machine.
Tested on Node v20.11.1.

```bash
npm install -g @stoplight/spectral-cli
```

This will install the `spectral` command globally. 
Note that you may need to add `sudo` if you're on a machine that lets you do this. 

If you can't run things as root, remove `-g`; you'll then need to use `npx spectral` to reference the executable in `node_modules`.

## Running checks
To run the rulesets against the sample spec, which should produce several errors - these commands assume you're running from the root of the repository.

```bash
# 1 Install the project
npm install

# 2 Ensure the project is built. 
npm run build

# 3 Invoke spectral referencing the disted rules you're interested in
spectral lint --ruleset ./shared/dist/spectral/rules-architecture.js ./shared/spectral-examples/bad-rest-api.json
```

## Learn more
See the [Spectral documentation](https://docs.stoplight.io/docs/spectral/674b27b261c3c-overview) for more information on how to configure the Spectral rules.

# Template bundles
## Widget Options

To pass default options to widgets in a template bundle, e.g. `docify/template-bundles/docusaurus`,
add something like the following to `index.json`:

```
    {
      "template": "index.md.hbs",
      "from": "document",
      "output": "docs/index.md",
      "output-type": "single"
      "front-matter": {
        "widgetOptions": {
          "block-architecture": {
            "theme": "light"
          }
        }
      }
    },
```

This will pass the option `theme` to all `block-architecture` widgets in `index.md.hbs`
