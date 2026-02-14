import { spawn, spawnSync } from 'child_process';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

const millisPerSecond = 1000;

function getInstalledCalmServerPath(): string {
  // In the workspace, calm-server binary would be at dist/index.js
  const calmServerPath = path.resolve(__dirname, '../../calm-server/dist/index.js');
  if (!fs.existsSync(calmServerPath)) {
    throw new Error(
      `calm-server binary not found at ${calmServerPath}. Run 'npm run build:calm-server' first.`
    );
  }
  return calmServerPath;
}

describe('calm-server (E2E)', () => {
  it('should start and respond to /health', async () => {
    const calmServerPath = getInstalledCalmServerPath();

    const serverProcess = spawn('node', [calmServerPath, '--port', '3002'], {
      stdio: 'pipe',
      detached: true,
    });

    await new Promise((r) => setTimeout(r, 2 * millisPerSecond));

    try {
      const res = await axios.get('http://127.0.0.1:3002/health');
      expect(res.status).toBe(200);
      expect(res.data.status).toBe('OK');
    } finally {
      process.kill(-serverProcess.pid);
    }
  }, 10000);

  it.skipIf(!fs.existsSync(path.join(__dirname, '../test_fixtures/api-gateway')))(
    'should validate an architecture',
    async () => {
      const calmServerPath = getInstalledCalmServerPath();

      const serverProcess = spawn('node', [calmServerPath, '--port', '3003'], {
        stdio: 'pipe',
        detached: true,
      });

      const validArchitecture = fs.readFileSync(
        path.join(__dirname, '../test_fixtures/validation_route/valid_instantiation.json'),
        'utf8'
      );

      await new Promise((r) => setTimeout(r, 2 * millisPerSecond));

      try {
        const res = await axios.post(
          'http://127.0.0.1:3003/calm/validate',
          JSON.parse(validArchitecture),
          { headers: { 'Content-Type': 'application/json' } }
        );
        expect(res.status).toBe(201);
        expect(JSON.stringify(res.data)).toContain('jsonSchemaValidationOutputs');
        expect(JSON.stringify(res.data)).toContain('spectralSchemaValidationOutputs');
        expect(JSON.stringify(res.data)).toContain('hasErrors');
        expect(JSON.stringify(res.data)).toContain('hasWarnings');
      } finally {
        process.kill(-serverProcess.pid);
      }
    },
    10000
  );

  it('should show help when --help is passed', async () => {
    const calmServerPath = getInstalledCalmServerPath();

    const result = spawnSync('node', [calmServerPath, '--help'], {
      encoding: 'utf-8',
      stdio: 'pipe',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('CALM Server');
  });
});
