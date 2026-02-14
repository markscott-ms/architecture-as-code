import express, { Application } from 'express';
import { ServerRoutes } from './routes/routes';
import { initLogger, SchemaDirectory } from '@finos/calm-shared';
import { Server } from 'http';

export function startServer(
  port: string | number,
  bindAddress: string,
  schemaDirectory: SchemaDirectory,
  verbose: boolean
): Server {
  const app: Application = express();
  const serverRoutesInstance = new ServerRoutes(schemaDirectory, verbose);
  const allRoutes = serverRoutesInstance.router;

  app.use(express.json());
  app.use('/', allRoutes);

  return app.listen(port, bindAddress, () => {
    const logger = initLogger(verbose, 'calm-server');
    logger.info(`CALM Server is running on http://${bindAddress}:${port}`);
  });
}
