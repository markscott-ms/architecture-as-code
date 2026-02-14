import request from 'supertest';
import express, { Application } from 'express';
import { HealthRouter } from './health-route';
import { describe, it, expect, beforeEach } from 'vitest';

describe('HealthRouter', () => {
  let app: Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    const router: express.Router = express.Router();
    app.use('/health', router);
    new HealthRouter(router);
  });

  it('should return 200 for health check', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'OK' });
  });
});
