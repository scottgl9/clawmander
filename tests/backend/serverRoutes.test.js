const express = require('express');
const http = require('http');
const serverRoutes = require('../../backend/routes/server');

function createTestApp(serverStatusService) {
  const app = express();
  app.use('/api/server', serverRoutes(serverStatusService));
  return app;
}

function request(app, path) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      http.get(`http://127.0.0.1:${port}${path}`, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          server.close();
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        });
      }).on('error', (err) => {
        server.close();
        reject(err);
      });
    });
  });
}

describe('GET /api/server/status', () => {
  test('returns status from ServerStatusService', async () => {
    const mockService = {
      getStatus: jest.fn().mockReturnValue({
        connection: 'connected',
        connectedAt: '2025-01-01T00:00:00.000Z',
        openClawUrl: 'ws://127.0.0.1:18789',
        serverVersion: '2.0.0',
        serverHost: 'gw-1',
        uptimeMs: 60000,
        sessionDefaults: null,
        presence: [],
        statusSummary: null,
        lastHeartbeat: null,
        lastUpdated: '2025-01-01T00:01:00.000Z',
        lastStatusFetch: null,
      }),
    };

    const app = createTestApp(mockService);
    const res = await request(app, '/api/server/status');

    expect(res.status).toBe(200);
    expect(res.body.connection).toBe('connected');
    expect(res.body.openClawUrl).toBe('ws://127.0.0.1:18789');
    expect(res.body.serverVersion).toBe('2.0.0');
    expect(mockService.getStatus).toHaveBeenCalledTimes(1);
  });

  test('returns disconnected state when no connection', async () => {
    const mockService = {
      getStatus: jest.fn().mockReturnValue({
        connection: 'disconnected',
        connectedAt: null,
        openClawUrl: null,
        serverVersion: null,
        serverHost: null,
        uptimeMs: null,
        sessionDefaults: null,
        presence: [],
        statusSummary: null,
        lastHeartbeat: null,
        lastUpdated: null,
        lastStatusFetch: null,
      }),
    };

    const app = createTestApp(mockService);
    const res = await request(app, '/api/server/status');

    expect(res.status).toBe(200);
    expect(res.body.connection).toBe('disconnected');
    expect(res.body.serverVersion).toBeNull();
    expect(res.body.presence).toEqual([]);
  });
});
