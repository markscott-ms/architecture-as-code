import {
    Docifier,
    DocifyMode,
    TemplateProcessingMode,
    TemplateProcessor,
    DocumentLoader
} from '@finos/calm-shared';
import { Command } from 'commander';
import { MockInstance } from 'vitest';
import { parseDocumentLoaderConfig } from './cli';

let calmShared: typeof import('@finos/calm-shared');
let validateModule: typeof import('./command-helpers/validate');
let templateModule: typeof import('./command-helpers/template');
let optionsModule: typeof import('./command-helpers/generate-options');
let fileSystemDocLoaderModule: typeof import('@finos/calm-shared/dist/document-loader/file-system-document-loader');
let cliConfigModule: typeof import('./cli-config');
let setupCLI: typeof import('./cli').setupCLI;
let parseDocumentLoaderConfig: typeof import('./cli').parseDocumentLoaderConfig;

describe('CLI Commands', () => {
    let program: Command;
    let mockDocLoader: DocumentLoader;

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        vi.unstubAllEnvs();

        calmShared = await import('@finos/calm-shared');
        validateModule = await import('./command-helpers/validate');
        templateModule = await import('./command-helpers/template');
        optionsModule = await import('./command-helpers/generate-options');
        fileSystemDocLoaderModule = await import('@finos/calm-shared/dist/document-loader/file-system-document-loader');
        cliConfigModule = await import('./cli-config');

        vi.spyOn(calmShared, 'runGenerate').mockResolvedValue(undefined);
        vi.spyOn(calmShared.TemplateProcessor.prototype, 'processTemplate').mockResolvedValue(undefined);
        vi.spyOn(calmShared.Docifier.prototype, 'docify').mockResolvedValue(undefined);

        vi.spyOn(validateModule, 'runValidate').mockResolvedValue(undefined);
        vi.spyOn(validateModule, 'checkValidateOptions').mockResolvedValue(undefined);

        vi.spyOn(templateModule, 'getUrlToLocalFileMap').mockReturnValue(new Map());

        vi.spyOn(optionsModule, 'promptUserForOptions').mockResolvedValue([]);

        mockDocLoader = {
            initialise: vi.fn().mockResolvedValue(undefined),
            loadMissingDocument: vi.fn().mockResolvedValue({}),
            resolvePath: vi.fn().mockReturnValue(undefined)
        };
        vi.spyOn(calmShared, 'buildDocumentLoader').mockReturnValue(mockDocLoader);

        vi.spyOn(cliConfigModule, 'loadCliConfig').mockImplementation(vi.fn());

        const cliModule = await import('./cli');
        setupCLI = cliModule.setupCLI;
        parseDocumentLoaderConfig = cliModule.parseDocumentLoaderConfig;

        program = new Command();
        setupCLI(program);
    });

    describe('Generate Command', () => {
        it('should call runGenerate with correct arguments', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'generate',
                '-p', 'pattern.json',
                '-o', 'output.json',
                '--verbose',
                '--schema-directory', 'schemas',
            ]);

            expect(mockDocLoader.loadMissingDocument).toHaveBeenCalledWith('pattern.json', 'pattern');
            expect(optionsModule.promptUserForOptions).toHaveBeenCalled();

            expect(calmShared.buildDocumentLoader).toHaveBeenCalledWith(expect.objectContaining({
                schemaDirectoryPath: 'schemas',
                debug: true,
                basePath: process.cwd()
            }));

            expect(calmShared.runGenerate).toHaveBeenCalledWith(
                {}, 'output.json', true, expect.any(calmShared.SchemaDirectory), []
            );
        });
    });

    describe('Validate Command', () => {
        it('should call runValidate with correct options', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'validate',
                '-p', 'pattern.json',
                '-a', 'arch.json',
            ]);

            expect(validateModule.checkValidateOptions).toHaveBeenCalled();
            expect(validateModule.runValidate).toHaveBeenCalledWith(expect.objectContaining({
                patternPath: 'pattern.json',
                architecturePath: 'arch.json',
            }));
        });
    });

    describe('Template Command', () => {
        let processorConstructorSpy: MockInstance<(this: TemplateProcessor, inputPath: string, templateBundlePath: string, outputPath: string, urlToLocalPathMapping: Map<string, string>, mode?: TemplateProcessingMode) => TemplateProcessor>;

        beforeEach(() => {
            processorConstructorSpy = vi
                .spyOn(calmShared, 'TemplateProcessor')
                .mockImplementation(() => {
                    return {
                        processTemplate: vi.fn().mockResolvedValue(undefined),
                    } as unknown as TemplateProcessor; //This works to get round any but prob not spying properly (used in other tests)
                });
        });

        it('should handle --bundle mode correctly', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'template',
                '--architecture', 'model.json',
                '--bundle', 'templateDir',
                '--output', 'outDir',
                '--verbose',
            ]);

            expect(processorConstructorSpy).toHaveBeenCalledWith(
                'model.json',
                'templateDir',
                'outDir',
                expect.any(Map),
                'bundle',
                false,
                false
            );
        });

        it('should handle --template mode correctly', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'template',
                '--architecture', 'model.json',
                '--template', 'template.hbs',
                '--output', 'outDir',
            ]);

            expect(processorConstructorSpy).toHaveBeenCalledWith(
                'model.json',
                'template.hbs',
                'outDir',
                expect.any(Map),
                'template',
                false,
                false
            );
        });

        it('should handle --template-dir mode correctly', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'template',
                '--architecture', 'model.json',
                '--template-dir', 'templates/',
                '--output', 'outDir',
            ]);

            expect(processorConstructorSpy).toHaveBeenCalledWith(
                'model.json',
                'templates/',
                'outDir',
                expect.any(Map),
                'template-directory',
                false,
                false
            );
        });

        it('should honour --clear-output-directory', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'template',
                '--architecture', 'model.json',
                '--template-dir', 'templates/',
                '--output', 'outDir',
                '--clear-output-directory'
            ]);

            expect(processorConstructorSpy).toHaveBeenCalledWith(
                'model.json',
                'templates/',
                'outDir',
                expect.any(Map),
                'template-directory',
                false,
                true
            );
        });

        it('should exit if multiple template flags are provided', async () => {
            const exitSpy = vi.spyOn(process, 'exit').mockImplementationOnce(() => {
                throw new Error('process.exit called');
            });

            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            await expect(program.parseAsync([
                'node', 'cli.js', 'template',
                '--architecture', 'model.json',
                '--template', 't1.hbs',
                '--bundle', 'bundle',
                '--output', 'outDir'
            ])).rejects.toThrow('process.exit called');

            expect(errorSpy).toHaveBeenCalledWith('❌ Please specify exactly one of --template, --template-dir, or --bundle');
            expect(exitSpy).toHaveBeenCalledWith(1);

            exitSpy.mockRestore();
            errorSpy.mockRestore();
        });
    });


    describe('Docify Command', () => {
        let docifierConstructorSpy: MockInstance<
            (this: Docifier,
                mode: DocifyMode,
                inputPath: string,
                outputPath: string,
                urlMappingPath?: string,
                templateProcessingMode?: TemplateProcessingMode,
                templatePath?: string) => Docifier
        >;

        beforeEach(() => {
            docifierConstructorSpy = vi
                .spyOn(calmShared, 'Docifier')
                .mockImplementation(() => ({
                    docify: vi.fn().mockResolvedValue(undefined),
                } as unknown as Docifier));
        });

        it('should default to WEBSITE mode with bundle', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'docify',
                '--architecture', 'model.json',
                '--output', 'outDir',
            ]);

            expect(docifierConstructorSpy).toHaveBeenCalledWith(
                'WEBSITE',
                'model.json',
                'outDir',
                undefined,
                'bundle',
                undefined,
                false,
                false
            );
        });

        it('should honour --clear-output-directory', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'docify',
                '--architecture', 'model.json',
                '--output', 'outDir',
                '--clear-output-directory'
            ]);

            expect(docifierConstructorSpy).toHaveBeenCalledWith(
                'WEBSITE',
                'model.json',
                'outDir',
                undefined,
                'bundle',
                undefined,
                true,
                false
            );
        });

        it('should use template mode if --template is specified', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'docify',
                '--architecture', 'model.json',
                '--output', 'outDir',
                '--template', 'template.hbs',
            ]);

            expect(docifierConstructorSpy).toHaveBeenCalledWith(
                'USER_PROVIDED',
                'model.json',
                'outDir',
                undefined,
                'template',
                'template.hbs',
                false,
                false
            );
        });

        it('should use template-directory mode if --template-dir is specified', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'docify',
                '--architecture', 'model.json',
                '--output', 'outDir',
                '--template-dir', 'templateDir',
            ]);

            expect(docifierConstructorSpy).toHaveBeenCalledWith(
                'USER_PROVIDED',
                'model.json',
                'outDir',
                undefined,
                'template-directory',
                'templateDir',
                false,
                false
            );
        });

        it('should exit if both --template and --template-dir are specified', async () => {
            const exitSpy = vi.spyOn(process, 'exit').mockImplementationOnce(() => {
                throw new Error('process.exit called');
            });
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            await expect(program.parseAsync([
                'node', 'cli.js', 'docify',
                '--architecture', 'model.json',
                '--output', 'outDir',
                '--template', 't1.hbs',
                '--template-dir', 'templateDir'
            ])).rejects.toThrow('process.exit called');

            expect(errorSpy).toHaveBeenCalledWith('❌ Please specify only one of --template or --template-dir');
            expect(exitSpy).toHaveBeenCalledWith(1);

            exitSpy.mockRestore();
            errorSpy.mockRestore();
        });

        it('should use WEBSITE mode by default', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'docify',
                '--architecture', 'model.json',
                '--output', 'outDir',
            ]);

            expect(docifierConstructorSpy).toHaveBeenCalledWith(
                'WEBSITE',
                'model.json',
                'outDir',
                undefined,
                'bundle',
                undefined,
                false,
                false
            );
        });

        it('should use USER_PROVIDED mode when --template is specified', async () => {
            await program.parseAsync([
                'node', 'cli.js', 'docify',
                '--architecture', 'model.json',
                '--output', 'outDir',
                '--template', 'template.hbs',
            ]);

            expect(docifierConstructorSpy).toHaveBeenCalledWith(
                'USER_PROVIDED',
                'model.json',
                'outDir',
                undefined,
                'template',
                'template.hbs',
                false,
                false
            );
        });
    });

    describe('Document Loader options', () => {
        it('config when no options selected', async () => {
            const config = await parseDocumentLoaderConfig({
            });
            expect(config.calmHubUrl).toBeUndefined();
            expect(config.calmHubPlugin).toBeUndefined();
            expect(config.schemaDirectoryPath).toBeUndefined();
            expect(config.debug).toBeFalsy();
        });

        it('config with CalmHub defined in config file', async () => {
            vi.spyOn(cliConfigModule, 'loadCliConfig').mockImplementation(() => {
                return {
                    calmHubUrl: 'calmhub.local',
                    calmHubPlugin: 'plugin-name'
                };
            });

            const config = await parseDocumentLoaderConfig({});
            expect(config.calmHubUrl).toBe('calmhub.local');
            expect(config.calmHubPlugin).toBe('plugin-name');
        });

        it('config with CalmHub defined in config file overridden by options', async () => {
            vi.spyOn(cliConfigModule, 'loadCliConfig').mockImplementation(() => {
                return {
                    calmHubUrl: 'calmhub.local',
                    calmHubPlugin: 'plugin-name'
                };
            });

            const config = await parseDocumentLoaderConfig({
                calmHubUrl: 'override.local',
                calmHubPlugin: 'override-plugin'
            });
            expect(config.calmHubUrl).toBe('override.local');
            expect(config.calmHubPlugin).toBe('override-plugin');
        });

        it('config with CalmHub defined in config file overridden by environment', async () => {
            vi.spyOn(cliConfigModule, 'loadCliConfig').mockImplementation(() => {
                return {
                    calmHubUrl: 'calmhub.local',
                    calmHubPlugin: 'plugin-name'
                };
            });

            vi.stubEnv('CALM_HUB_URL', 'env.local');
            vi.stubEnv('CALM_HUB_PLUGIN', 'env-plugin');
            const config = await parseDocumentLoaderConfig({});
            expect(config.calmHubUrl).toBe('env.local');
            expect(config.calmHubPlugin).toBe('env-plugin');
        });

        it('config with CalmHub defined in environment overridden by options', async () => {
            vi.stubEnv('CALM_HUB_URL', 'env.local');
            vi.stubEnv('CALM_HUB_PLUGIN', 'env-plugin');
            const config = await parseDocumentLoaderConfig({
                calmHubUrl: 'calmhub.local',
                calmHubPlugin: 'plugin-name'
            });
            expect(config.calmHubUrl).toBe('calmhub.local');
            expect(config.calmHubPlugin).toBe('plugin-name');
        });
    });
});

describe('parseDocumentLoaderConfig', () => {
    it('should parse calmhub url when provided', async () => {
        const options = await parseDocumentLoaderConfig({
            calmHubUrl: 'calmhub'
        });
        expect(options.calmHubUrl).toEqual('calmhub');
    });

    it('should override calmhub url in file when provided', async () => {
        cliConfigModule = await import('./cli-config');
        vi.spyOn(cliConfigModule, 'loadCliConfig').mockResolvedValue({ calmHubUrl: 'calmhub-file' });

        const options = await parseDocumentLoaderConfig({
            calmHubUrl: 'calmhub-cli'
        });
        expect(options.calmHubUrl).toEqual('calmhub-cli');
    });

    it('should parse schemaDirectoryPath when provided', async () => {
        const options = await parseDocumentLoaderConfig({
            schemaDirectory: 'path'
        });
        expect(options.schemaDirectoryPath).toEqual('path');
    });

    it('should set debug to true when verbose passed along', async () => {
        const options = await parseDocumentLoaderConfig({
            verbose: true
        });
        expect(options.debug).toBeTruthy();
    });

    it('should default debug to false', async () => {
        const options = await parseDocumentLoaderConfig({
        });
        expect(options.debug).toBeFalsy();
    });
});