/**
 * Authentication provider implementations
 *
 * Built-in providers:
 * - NoAuthProvider: Pass-through for unauthenticated access
 * - BearerTokenProvider: Static bearer token (API keys, pre-obtained tokens)
 * - OAuthDeviceFlowProvider: OAuth2 Device Code Flow (RFC 8628) - best for CLI
 * - OAuthAuthCodeFlowProvider: OAuth2 Authorization Code Flow with PKCE (RFC 7636) - best for VSCode
 *
 * Custom providers can be registered via authProviderRegistry.register()
 */

export { NoAuthProvider } from './no-auth-provider';
export { BearerTokenProvider, RetrievableBearerTokenProvider } from './bearer-token-provider';
export { OAuthDeviceFlowProvider } from './oauth-device-flow-provider';
export { OAuthAuthCodeFlowProvider } from './oauth-authcode-flow-provider';
