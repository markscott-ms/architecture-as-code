#!/usr/bin/env node

import { program } from 'commander';
import {
  CALM_META_SCHEMA_DIRECTORY,
  initLogger,
  SchemaDirectory,
} from '@finos/calm-shared';
import { FileSystemDocumentLoader } from '@finos/calm-shared/dist/document-loader/file-system-document-loader';
import { startServer } from './server';

const DEFAULT_PORT = 3000;
const DEFAULT_BIND_ADDRESS = '127.0.0.1';
const VERSION = '0.1.0';

program
  .version(VERSION)
  .description(
    'CALM Server - REST API for validating CALM architectures and patterns'
  )
  .option(
    '-p, --port <number>',
    'Port to run the server on',
    String(DEFAULT_PORT)
  )
  .option(
    '-b, --bind <address>',
    'Address to bind to (default: 127.0.0.1 for local access only)',
    DEFAULT_BIND_ADDRESS
  )
  .option('-v, --verbose', 'Enable verbose logging', false)
  .action(async (options) => {
    const port = options.port;
    const bindAddress = options.bind;
    const verbose = !!options.verbose;

    const logger = initLogger(verbose, 'calm-server');

    // Warn if binding to non-localhost
    if (bindAddress !== '127.0.0.1' && bindAddress !== 'localhost') {
      console.warn(
        '\n⚠️  WARNING: CALM Server is listening on all network interfaces.'
      );
      console.warn(
        'No authentication or authorization is provided by this server.'
      );
      console.warn(
        'Ensure your network security is properly configured.\n'
      );
    }

    try {
      // Build schema directory using embedded CALM schemas
      const docLoader = new FileSystemDocumentLoader(
        [CALM_META_SCHEMA_DIRECTORY],
        false
      );
      const schemaDirectory = new SchemaDirectory(docLoader, verbose);

      // Start the server
      const server = startServer(port, bindAddress, schemaDirectory, verbose);

      logger.info(`CALM Server is running on http://${bindAddress}:${port}`);
      logger.info('Available endpoints:');
      logger.info('  GET  /health              - Health check');
      logger.info('  POST /calm/validate       - Validate CALM architecture');

      // Graceful shutdown
      process.on('SIGTERM', () => {
        logger.info('SIGTERM received, closing server...');
        server.close(() => {
          logger.info('Server closed');
          process.exit(0);
        });
      });

      process.on('SIGINT', () => {
        logger.info('SIGINT received, closing server...');
        server.close(() => {
          logger.info('Server closed');
          process.exit(0);
        });
      });
    } catch (error) {
      logger.error('Failed to start server: ' + error);
      process.exit(1);
    }
  });

program.parse(process.argv);

// Export for programmatic use as a library
export { startServer };
export type { } from './server';
