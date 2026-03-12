const express = require('express');
const { browserRoutes } = require('../../backend/routes/browser');

// Mock auth middleware
jest.mock('../../backend/middleware/anyAuth', () => (req, res, next) => next());

function createMockBrowserManager() {
  const instances = new Map();

  const mockInstance = (id) => ({
    id,
    getInfo: jest.fn().mockReturnValue({ id, url: 'about:blank', controlMode: 'shared', viewers: 0, lastActivity: Date.now(), viewport: { width: 1280, height: 800 } }),
    navigate: jest.fn().mockResolvedValue({ url: 'https://example.com', title: 'Example' }),
    click: jest.fn().mockResolvedValue(undefined),
    clickSelector: jest.fn().mockResolvedValue(undefined),
    type: jest.fn().mockResolvedValue(undefined),
    pressKey: jest.fn().mockResolvedValue(undefined),
    scroll: jest.fn().mockResolvedValue(undefined),
    screenshot: jest.fn().mockResolvedValue({ image: 'base64data', width: 1280, height: 800 }),
    evaluate: jest.fn().mockResolvedValue({ result: 42 }),
    getPageContent: jest.fn().mockResolvedValue({ text: 'hello', html: '<p>hello</p>' }),
    waitForSelector: jest.fn().mockResolvedValue({ found: true }),
    setControlMode: jest.fn(),
    requestUserControl: jest.fn().mockResolvedValue({ timedOut: false }),
  });

  return {
    listInstances: jest.fn().mockReturnValue([]),
    createInstance: jest.fn().mockImplementation(async (id) => {
      if (instances.has(id)) {
        throw Object.assign(new Error(`Browser instance "${id}" already exists`), { code: 'DUPLICATE' });
      }
      const inst = mockInstance(id);
      instances.set(id, inst);
      return inst;
    }),
    getInstance: jest.fn().mockImplementation((id) => instances.get(id) || null),
    destroyInstance: jest.fn().mockImplementation(async (id) => {
      if (!instances.has(id)) return false;
      instances.delete(id);
      return true;
    }),
    _instances: instances,
    _mockInstance: mockInstance,
  };
}

// Simple supertest-like helper
function createApp(manager) {
  const app = express();
  app.use(express.json());
  app.use('/api/browser', browserRoutes(manager));
  return app;
}

let http;
let server;
let manager;

beforeEach((done) => {
  http = require('http');
  manager = createMockBrowserManager();
  const app = createApp(manager);
  server = http.createServer(app);
  server.listen(0, done);
});

afterEach((done) => {
  server.close(done);
});

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, `http://localhost:${server.address().port}`);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: { 'Content-Type': 'application/json' },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

describe('Browser REST routes', () => {
  test('GET /api/browser returns instance list', async () => {
    const res = await request('GET', '/api/browser');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /api/browser creates instance', async () => {
    const res = await request('POST', '/api/browser', { id: 'new-1' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('new-1');
  });

  test('POST /api/browser with duplicate returns 409', async () => {
    await request('POST', '/api/browser', { id: 'dup' });
    const res = await request('POST', '/api/browser', { id: 'dup' });
    expect(res.status).toBe(409);
  });

  test('POST /api/browser over max returns 429', async () => {
    manager.createInstance.mockRejectedValueOnce(
      Object.assign(new Error('Maximum browser instances reached'), { code: 'MAX_INSTANCES' })
    );
    const res = await request('POST', '/api/browser', { id: 'over' });
    expect(res.status).toBe(429);
  });

  test('GET /api/browser/:id returns instance detail', async () => {
    await request('POST', '/api/browser', { id: 'detail' });
    const res = await request('GET', '/api/browser/detail');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('detail');
  });

  test('GET /api/browser/:id returns 404 for unknown', async () => {
    const res = await request('GET', '/api/browser/unknown');
    expect(res.status).toBe(404);
  });

  test('DELETE /api/browser/:id destroys instance', async () => {
    await request('POST', '/api/browser', { id: 'del' });
    const res = await request('DELETE', '/api/browser/del');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('DELETE /api/browser/:id returns 404 for unknown', async () => {
    const res = await request('DELETE', '/api/browser/unknown');
    expect(res.status).toBe(404);
  });

  test('POST /api/browser/:id/navigate navigates', async () => {
    await request('POST', '/api/browser', { id: 'nav' });
    const res = await request('POST', '/api/browser/nav/navigate', { url: 'https://example.com' });
    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://example.com');
  });

  test('POST /api/browser/:id/screenshot returns image', async () => {
    await request('POST', '/api/browser', { id: 'ss' });
    const res = await request('POST', '/api/browser/ss/screenshot');
    expect(res.status).toBe(200);
    expect(res.body.image).toBe('base64data');
  });

  test('POST /api/browser/:id/control changes mode', async () => {
    await request('POST', '/api/browser', { id: 'ctrl' });
    const res = await request('POST', '/api/browser/ctrl/control', { mode: 'agent' });
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('agent');
  });

  test('unknown instance returns 404 for action routes', async () => {
    const res = await request('POST', '/api/browser/nope/navigate', { url: 'https://example.com' });
    expect(res.status).toBe(404);
  });
});
