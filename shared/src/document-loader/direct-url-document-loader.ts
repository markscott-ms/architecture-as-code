import axios, { Axios, AxiosError } from 'axios';
import { SchemaDirectory } from '../schema-directory';
import { CalmDocumentType, DocumentLoader } from './document-loader';
import { DocumentLoadError } from './document-loader';
import { Logger, initLogger } from '../logger';
import { type AuthProvider } from '../auth/auth-provider';

export class DirectUrlDocumentLoader implements DocumentLoader {
    private readonly ax: Axios;
    private logger: Logger;
    private authProvider?: AuthProvider;

    constructor(debug: boolean, axiosInstance?: Axios, authProvider?: AuthProvider) {
        this.authProvider = authProvider;

        if (axiosInstance) {
            this.ax = axiosInstance;
        } else {
            this.ax = axios.create({
                timeout: 10000,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Set up authentication interceptors
        this.setupAuthInterceptors();

        this.logger = initLogger(debug, 'direct-url-document-loader');
        if (debug) {
            this.addAxiosDebug();
        }
    }

    /**
     * Set up axios request/response interceptors for authentication
     */
    private setupAuthInterceptors(): void {
        if (!this.authProvider) {
            return;
        }

        // Request interceptor: inject auth headers
        this.ax.interceptors.request.use((config) => {
            const authHeaders = this.authProvider!.getAuthHeaders();
            if (authHeaders && Object.keys(authHeaders).length > 0) {
                for (const [key, value] of Object.entries(authHeaders)) {
                    config.headers[key] = value;
                }
            }
            return config;
        });

        // Response interceptor: handle 401 with token refresh
        this.ax.interceptors.response.use(
            (response) => response,
            async (error: AxiosError) => {
                const originalRequest = error.config as any;

                // If 401 and we have auth provider, try to refresh token
                if (error.response?.status === 401 && originalRequest && !originalRequest._retried) {
                    originalRequest._retried = true;

                    try {
                        // Attempt refresh
                        await this.authProvider!.refresh();

                        // Retry request with new token
                        const authHeaders = this.authProvider!.getAuthHeaders();
                        if (authHeaders && Object.keys(authHeaders).length > 0) {
                            for (const [key, value] of Object.entries(authHeaders)) {
                                originalRequest.headers[key] = value;
                            }
                        }

                        return this.ax.request(originalRequest);
                    } catch (refreshError) {
                        throw new Error(
                            `Authentication failed: token refresh unsuccessful. ${refreshError instanceof Error ? refreshError.message : String(refreshError)
                            }`
                        );
                    }
                }

                throw error;
            }
        );
    }

    addAxiosDebug() {
        this.ax.interceptors.request.use(request => {
            console.log('Starting Request', JSON.stringify(request, null, 2));
            return request;
        });

        this.ax.interceptors.response.use(response => {
            console.log('Response:', response);
            return response;
        });
    }

    async initialise(_: SchemaDirectory): Promise<void> {
        // No-op, similar to CalmHubDocumentLoader
        return;
    }

    async loadMissingDocument(documentId: string, _type: CalmDocumentType): Promise<object> {
        try {
            const parsedUrl = new URL(documentId);
            const allowedProtocols = ['http:', 'https:'];
            if (!allowedProtocols.includes(parsedUrl.protocol)) {
                throw new DocumentLoadError({
                    name: 'UNKNOWN',
                    message: `Unsupported URL protocol '${parsedUrl.protocol}' in document URL. Only HTTP and HTTPS are allowed.`,
                });
            }
            const response = await this.ax.get(parsedUrl.toString());
            return response.data;
        } catch (error) {
            if (error instanceof DocumentLoadError) {
                throw error;
            }
            throw new DocumentLoadError({
                name: 'UNKNOWN',
                message: `Failed to load document from URL: ${documentId}`,
                cause: error instanceof Error ? error : undefined
            });
        }
    }

    /**
     * Only local files via a mapping file are currently supported.
     */
    resolvePath(_reference: string): string | undefined {
        return undefined;
    }
}
