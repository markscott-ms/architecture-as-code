import { Router } from 'express';
import { ServerRoutes } from './routes';
import { ValidationRouter } from './validation-route';
import { HealthRouter } from './health-route';
import { SchemaDirectory } from '@finos/calm-shared';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUse = vi.fn();
const mockRouter = {
  use: mockUse,
};

vi.mock('express', () => ({
  Router: vi.fn(() => mockRouter),
}));

vi.mock('./validation-route', () => {
  return {
    ValidationRouter: vi.fn(),
  };
});

vi.mock('./health-route', () => {
  return {
    HealthRouter: vi.fn(),
  };
});

vi.mock('@finos/calm-shared', () => {
  return {
    SchemaDirectory: vi.fn(),
  };
});

describe('ServerRoutes', () => {
  let schemaDirectory: SchemaDirectory;
  let serverRoutes: ServerRoutes;
  let mockRouterInstance: Router;

  beforeEach(() => {
    serverRoutes = new ServerRoutes(schemaDirectory);
    mockRouterInstance = serverRoutes.router;
  });

  it('should initialize router', () => {
    expect(Router).toHaveBeenCalled();
  });

  it('should set up validate route', () => {
    expect(mockRouterInstance.use).toHaveBeenCalledWith(
      '/calm/validate',
      mockRouterInstance
    );
    expect(ValidationRouter).toHaveBeenCalled();
  });

  it('should set up health route', () => {
    expect(mockRouterInstance.use).toHaveBeenCalledWith(
      '/health',
      mockRouterInstance
    );
    expect(HealthRouter).toHaveBeenCalled();
  });
});
