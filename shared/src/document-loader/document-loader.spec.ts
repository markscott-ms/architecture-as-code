import { CALM_META_SCHEMA_DIRECTORY } from '../consts';
import { buildDocumentLoader, DocumentLoaderOptions } from './document-loader';

const mocks = vi.hoisted(() => {
    return {
        fsDocLoader: vi.fn(() => ({
            initialise: vi.fn(),
            loadMissingDocument: vi.fn()
        })),
        calmHubDocLoader: vi.fn(() => ({
            initialise: vi.fn(),
            loadMissingDocument: vi.fn()
        })),
        calmHubCustomDocLoader: vi.fn(() => ({
            initialise: vi.fn(),
            loadMissingDocument: vi.fn()
        })),
        mappedDocLoader: vi.fn(() => ({
            initialise: vi.fn(),
            loadMissingDocument: vi.fn()
        }))
    };
});


vi.mock('./file-system-document-loader', () => {
    return {
        FileSystemDocumentLoader: mocks.fsDocLoader
    };
});

vi.mock('./calmhub-document-loader', () => {
    return {
        CalmHubDocumentLoader: mocks.calmHubDocLoader
    };
});

vi.mock('./calmhub-custom-document-loader', () => {
    return {
        CalmHubCustomDocumentLoader: mocks.calmHubCustomDocLoader
    };
});

vi.mock('./mapped-document-loader', () => {
    return {
        MappedDocumentLoader: mocks.mappedDocLoader
    };
});

describe('DocumentLoader', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    it('should create a FileSystemDocumentLoader', () => {

        const docLoaderOpts: DocumentLoaderOptions = {
            schemaDirectoryPath: 'schemas'
        };

        buildDocumentLoader(docLoaderOpts);

        expect(mocks.fsDocLoader).toHaveBeenCalledWith([CALM_META_SCHEMA_DIRECTORY, 'schemas'], false, process.cwd());
    });

    it('should create a CalmHubDocumentLoader when calmHubUrl is defined in loader options', () => {

        const docLoaderOpts: DocumentLoaderOptions = {
            calmHubUrl: 'https://example.com'
        };

        buildDocumentLoader(docLoaderOpts);

        expect(mocks.calmHubDocLoader).toHaveBeenCalledWith('https://example.com', false);
        expect(mocks.calmHubCustomDocLoader).not.toHaveBeenCalled();
    });

    it('should create a CalmHubCustomDocumentLoader when calmHubUrl and calmHubPlugin are defined in loader options', () => {
        const docLoaderOpts: DocumentLoaderOptions = {
            calmHubUrl: 'https://example.com',
            calmHubPlugin: 'my-calmhub-plugin'
        };

        buildDocumentLoader(docLoaderOpts);

        expect(mocks.calmHubDocLoader).not.toHaveBeenCalled();
        expect(mocks.calmHubCustomDocLoader).toHaveBeenCalledWith('https://example.com', 'my-calmhub-plugin', false);
    });

    it('should not create a CalmHubDocumentLoader or CalmHubCustomDocumentLoader if calmHubUrl is not defined in loader options', () => {
        const docLoaderOpts: DocumentLoaderOptions = {
            calmHubPlugin: 'my-calmhub-plugin'
        };

        buildDocumentLoader(docLoaderOpts);

        expect(mocks.calmHubDocLoader).not.toHaveBeenCalled();
        expect(mocks.calmHubCustomDocLoader).not.toHaveBeenCalled();
    });

    it('should create a MappedDocumentLoader when urlToLocalMap is provided', () => {
        const urlMap = new Map([
            ['https://example.com/schema.json', 'local/schema.json']
        ]);

        const docLoaderOpts: DocumentLoaderOptions = {
            urlToLocalMap: urlMap
        };

        buildDocumentLoader(docLoaderOpts);

        expect(mocks.mappedDocLoader).toHaveBeenCalledWith(urlMap, process.cwd(), false);
    });

    it('should create a MappedDocumentLoader when basePath is provided', () => {
        const docLoaderOpts: DocumentLoaderOptions = {
            basePath: '/project/patterns'
        };

        buildDocumentLoader(docLoaderOpts);

        expect(mocks.mappedDocLoader).toHaveBeenCalledWith(new Map(), '/project/patterns', false);
    });

    it('should create a MappedDocumentLoader with both urlToLocalMap and basePath', () => {
        const urlMap = new Map([
            ['https://example.com/schema.json', 'local/schema.json']
        ]);

        const docLoaderOpts: DocumentLoaderOptions = {
            urlToLocalMap: urlMap,
            basePath: '/custom/base'
        };

        buildDocumentLoader(docLoaderOpts);

        expect(mocks.mappedDocLoader).toHaveBeenCalledWith(urlMap, '/custom/base', false);
    });

    it('should not create a MappedDocumentLoader when neither urlToLocalMap nor basePath provided', () => {
        const docLoaderOpts: DocumentLoaderOptions = {};

        buildDocumentLoader(docLoaderOpts);

        expect(mocks.mappedDocLoader).not.toHaveBeenCalled();
    });

    it('should not create a MappedDocumentLoader when urlToLocalMap is empty and no basePath', () => {
        const docLoaderOpts: DocumentLoaderOptions = {
            urlToLocalMap: new Map()
        };

        buildDocumentLoader(docLoaderOpts);

        expect(mocks.mappedDocLoader).not.toHaveBeenCalled();
    });

    it('should create a MappedDocumentLoader when urlToLocalMap is provided', () => {
        const urlMap = new Map([
            ['https://example.com/schema.json', 'local/schema.json']
        ]);

        const docLoaderOpts: DocumentLoaderOptions = {
            urlToLocalMap: urlMap
        };

        buildDocumentLoader(docLoaderOpts);

        expect(mocks.mappedDocLoader).toHaveBeenCalledWith(urlMap, process.cwd(), false);
    });

    it('should create a MappedDocumentLoader when basePath is provided', () => {
        const docLoaderOpts: DocumentLoaderOptions = {
            basePath: '/project/patterns'
        };

        buildDocumentLoader(docLoaderOpts);

        expect(mocks.mappedDocLoader).toHaveBeenCalledWith(new Map(), '/project/patterns', false);
    });

    it('should create a MappedDocumentLoader with both urlToLocalMap and basePath', () => {
        const urlMap = new Map([
            ['https://example.com/schema.json', 'local/schema.json']
        ]);

        const docLoaderOpts: DocumentLoaderOptions = {
            urlToLocalMap: urlMap,
            basePath: '/custom/base'
        };

        buildDocumentLoader(docLoaderOpts);

        expect(mocks.mappedDocLoader).toHaveBeenCalledWith(urlMap, '/custom/base', false);
    });

    it('should not create a MappedDocumentLoader when neither urlToLocalMap nor basePath provided', () => {
        const docLoaderOpts: DocumentLoaderOptions = {};

        buildDocumentLoader(docLoaderOpts);

        expect(mocks.mappedDocLoader).not.toHaveBeenCalled();
    });

    it('should not create a MappedDocumentLoader when urlToLocalMap is empty and no basePath', () => {
        const docLoaderOpts: DocumentLoaderOptions = {
            urlToLocalMap: new Map()
        };

        buildDocumentLoader(docLoaderOpts);

        expect(mocks.mappedDocLoader).not.toHaveBeenCalled();
    });
});