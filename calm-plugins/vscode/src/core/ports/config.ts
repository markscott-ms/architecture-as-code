/**
 * Configuration port - interface for accessing extension configuration
 * Part of hexagonal architecture - allows different config implementations
 */
export interface Config {
    filesGlobs(): string[]
    templateGlobs(): string[]
    previewLayout(): string
    showLabels(): boolean
    urlMapping(): string | undefined
    docifyTheme(): string
    schemaAdditionalFolders(): string[]
    authProvider(): string | undefined
    authOptions(): Record<string, unknown> | undefined
    authCredentialStorage(): string | undefined
    calmHubUrl(): string | undefined
}
