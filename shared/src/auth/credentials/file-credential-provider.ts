/**
 * File-based credential provider
 * Stores credentials in ~/.calm-credentials.json with mode 0600 (owner read/write only)
 * Separate from config file (~/.calm.json) for security
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { CredentialProvider } from '../auth-provider';

const CREDENTIALS_FILE = path.join(os.homedir(), '.calm-credentials.json');
const FILE_MODE = 0o600; // Read/write for owner only

interface StoredCredentials {
    [key: string]: string;
}

/**
 * Stores credentials in a secure JSON file with restricted permissions
 */
export class FileCredentialProvider implements CredentialProvider {
    private credentials: StoredCredentials = {};

    constructor() {
        this.load();
    }

    async store(key: string, value: string): Promise<void> {
        this.credentials[key] = value;
        await this.save();
    }

    async retrieve(key: string): Promise<string | undefined> {
        return this.credentials[key];
    }

    async delete(key: string): Promise<void> {
        delete this.credentials[key];
        await this.save();
    }

    async clear(): Promise<void> {
        this.credentials = {};
        await this.save();
    }

    private load(): void {
        try {
            if (fs.existsSync(CREDENTIALS_FILE)) {
                const content = fs.readFileSync(CREDENTIALS_FILE, 'utf-8');
                this.credentials = JSON.parse(content) as StoredCredentials;
            }
        } catch (error) {
            // If file is corrupted or unreadable, start with empty credentials
            console.warn(
                `Warning: Could not read credentials file: ${CREDENTIALS_FILE}`,
                error,
            );
            this.credentials = {};
        }
    }

    private async save(): Promise<void> {
        const content = JSON.stringify(this.credentials, null, 2);

        // Write with restricted permissions
        // Create file first if it doesn't exist
        if (!fs.existsSync(CREDENTIALS_FILE)) {
            // Create with restricted permissions using fd
            const fd = fs.openSync(CREDENTIALS_FILE, 'w', FILE_MODE);
            fs.writeFileSync(fd, content);
            fs.closeSync(fd);
        } else {
            // Write to existing file
            fs.writeFileSync(CREDENTIALS_FILE, content);
            // Ensure permissions are correct
            fs.chmodSync(CREDENTIALS_FILE, FILE_MODE);
        }
    }
}
