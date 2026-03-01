import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleAuthError } from './cli';

describe('handleAuthError', () => {
    let consoleErrorSpy: any;
    let processExitSpy: any;

    beforeEach(() => {
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
        processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { });
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        processExitSpy.mockRestore();
    });

    it('should detect and handle 401 errors', () => {
        const error = new Error('Request failed with status code 401');

        expect(() => handleAuthError(error)).toThrow();

        expect(consoleErrorSpy).toHaveBeenCalledWith('✗ Authentication required');
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('calm auth login'));
        expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should detect Unauthorized errors', () => {
        const error = new Error('Unauthorized access');

        expect(() => handleAuthError(error)).toThrow();

        expect(consoleErrorSpy).toHaveBeenCalledWith('✗ Authentication required');
        expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should detect Authentication required errors', () => {
        const error = new Error('Authentication required to access this resource');

        expect(() => handleAuthError(error)).toThrow();

        expect(consoleErrorSpy).toHaveBeenCalledWith('✗ Authentication required');
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('calm auth login'));
        expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should re-throw non-auth errors', () => {
        const error = new Error('Some other error');

        expect(() => handleAuthError(error)).toThrow('Some other error');

        expect(processExitSpy).not.toHaveBeenCalled();
    });

    it('should handle string errors', () => {
        expect(() => handleAuthError('401 error occurred')).toThrow();
        expect(consoleErrorSpy).toHaveBeenCalledWith('✗ Authentication required');
    });
});
