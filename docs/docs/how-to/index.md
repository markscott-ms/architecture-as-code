---
id: how-to-index
title: How-To Guides
sidebar_position: 4
---

# How-To Guides

Step-by-step guides for common tasks and advanced configurations in CALM.

## Authentication & Security

Learn how to configure secure authentication between CALM clients and CALM Hub:

### [Authenticate CLI with CALM Hub](cli-authentication.md)

Configure OAuth 2.0 authentication for the CALM CLI to connect securely to CALM Hub instances. Covers:
- OAuth Device Code Flow (recommended for CLI)
- Bearer Token authentication for CI/CD
- Provider-specific configurations (Okta, Azure AD, Keycloak)
- Troubleshooting authentication issues

**Recommended for:** CLI users, DevOps engineers, CI/CD integration

### [Authenticate VSCode Extension with CALM Hub](vscode-authentication.md)

Set up authentication in the VSCode extension to access remote CALM Hub. Covers:
- OAuth Authorization Code Flow with PKCE (recommended for VSCode)
- Workspace vs user settings
- Multi-environment configurations
- Authentication commands via Command Palette

**Recommended for:** VSCode users, architects, developers

### [Write a Custom Authentication Plugin](custom-auth-plugin.md)

Implement custom authentication providers for enterprise-specific requirements. Covers:
- AuthProvider interface implementation
- Certificate-based authentication example
- Custom token API integration
- Provider registration and testing
- Advanced patterns and best practices

**Recommended for:** Enterprise integrators, security teams, advanced users

## Coming Soon

More how-to guides are being prepared:

- **Generate Documentation from CALM Models** - Using the `docify` command
- **Validate Architectures Against Patterns** - Pattern enforcement and compliance
- **Integrate CALM with CI/CD Pipelines** - GitHub Actions, GitLab CI, Jenkins
- **Create Custom Widgets** - Extend visualization capabilities
- **Work with Template Bundles** - Custom documentation generation

## Additional Resources

- [Tutorials](../tutorials/) - Learn CALM from scratch
- [Core Concepts](../core-concepts/) - Understand CALM fundamentals
- [Working with CALM](../working-with-calm/) - CLI commands and tools
- [Complete Authentication Reference](https://github.com/finos/architecture-as-code/blob/main/AUTHENTICATION.md) - Full documentation on GitHub

## Need Help?

- [GitHub Issues](https://github.com/finos/architecture-as-code/issues) - Report bugs or request features
- [GitHub Discussions](https://github.com/finos/architecture-as-code/discussions) - Ask questions and share ideas
- [Community Meetings](https://github.com/finos/architecture-as-code/issues?q=label%3Ameeting) - Join monthly meetups
