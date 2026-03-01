/**
 * Credential provider implementations
 *
 * Built-in providers:
 * - FileCredentialProvider: Stores credentials in ~/.calm-credentials.json with mode 0600
 * - MemoryCredentialProvider: In-memory storage (for testing and CI)
 * - VscodeCredentialProvider: Uses VSCode SecretStorage API (in calm-plugins/vscode)
 *
 * Custom providers can be registered via credentialProviderRegistry.register()
 * Examples: HashiCorp Vault, Azure Key Vault, AWS Secrets Manager, etc.
 */

export { FileCredentialProvider } from './file-credential-provider';
export { MemoryCredentialProvider } from './memory-credential-provider';
