const express = require('express');
const http = require('http');
const gatewayRoutes = require('../../backend/routes/gateway');

jest.mock('child_process', () => ({
  exec: jest.fn((cmd, cb) => cb(null, '', '')),
}));

const { exec } = require('child_process');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/gateway', gatewayRoutes());
  return app;
}

function get(app, path) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      http.get(`http://127.0.0.1:${port}${path}`, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          server.close();
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        });
      }).on('error', (err) => { server.close(); reject(err); });
    });
  });
}

function post(app, path) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      const req = http.request({
        hostname: '127.0.0.1', port, path, method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          server.close();
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        });
      });
      req.on('error', (err) => { server.close(); reject(err); });
      req.end();
    });
  });
}

describe('Gateway Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('POST /api/gateway/restart returns 202 and calls exec', async () => {
    const app = createApp();
    const res = await post(app, '/api/gateway/restart');
    expect(res.status).toBe(202);
    expect(res.body.ok).toBe(true);
    expect(res.body.message).toContain('restart');
    expect(exec).toHaveBeenCalledWith('openclaw gateway restart', expect.any(Function));
  });

  test('GET /api/gateway/status returns connected true', async () => {
    const app = createApp();
    const res = await get(app, '/api/gateway/status');
    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(true);
  });
});
