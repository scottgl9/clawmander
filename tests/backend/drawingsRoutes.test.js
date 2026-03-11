const express = require('express');
const http = require('http');
const drawingsRoutes = require('../../backend/routes/drawings');

function createTestApp(mockDrawingService) {
  const app = express();
  app.use(express.json());
  app.use('/api/drawings', drawingsRoutes(mockDrawingService));
  return app;
}

function request(app, method, path, body) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      const options = {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer changeme',
        },
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          server.close();
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        });
      });
      req.on('error', (err) => { server.close(); reject(err); });
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  });
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

function createMockService(overrides = {}) {
  return {
    getAll: jest.fn().mockReturnValue([]),
    getById: jest.fn().mockReturnValue(null),
    create: jest.fn().mockReturnValue({ id: 'draw-1', title: 'Test', data: {}, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }),
    update: jest.fn().mockReturnValue(null),
    delete: jest.fn().mockReturnValue(false),
    ...overrides,
  };
}

describe('GET /api/drawings', () => {
  test('returns list of drawings', async () => {
    const drawings = [
      { id: 'draw-1', title: 'Diagram A', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
      { id: 'draw-2', title: 'Diagram B', createdAt: '2026-01-02T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z' },
    ];
    const service = createMockService({ getAll: jest.fn().mockReturnValue(drawings) });
    const app = createTestApp(service);
    const res = await get(app, '/api/drawings');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(drawings);
    expect(res.body).toHaveLength(2);
  });

  test('returns empty array when no drawings', async () => {
    const service = createMockService();
    const app = createTestApp(service);
    const res = await get(app, '/api/drawings');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('GET /api/drawings/:id', () => {
  test('returns full drawing with data', async () => {
    const drawing = { id: 'draw-1', title: 'Test', data: { elements: [{ id: 'el-1' }] }, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' };
    const service = createMockService({ getById: jest.fn().mockReturnValue(drawing) });
    const app = createTestApp(service);
    const res = await get(app, '/api/drawings/draw-1');

    expect(res.status).toBe(200);
    expect(res.body.data.elements).toHaveLength(1);
    expect(service.getById).toHaveBeenCalledWith('draw-1');
  });

  test('returns 404 for non-existent drawing', async () => {
    const service = createMockService();
    const app = createTestApp(service);
    const res = await get(app, '/api/drawings/nonexistent');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Drawing not found');
  });
});

describe('POST /api/drawings', () => {
  test('creates a new drawing', async () => {
    const service = createMockService();
    const app = createTestApp(service);
    const res = await request(app, 'POST', '/api/drawings', { title: 'My Diagram' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('draw-1');
    expect(service.create).toHaveBeenCalledWith({ title: 'My Diagram' });
  });
});

describe('PATCH /api/drawings/:id', () => {
  test('updates an existing drawing', async () => {
    const updated = { id: 'draw-1', title: 'Updated', data: { elements: [] }, updatedAt: '2026-01-02T00:00:00Z' };
    const service = createMockService({ update: jest.fn().mockReturnValue(updated) });
    const app = createTestApp(service);
    const res = await request(app, 'PATCH', '/api/drawings/draw-1', { title: 'Updated' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated');
    expect(service.update).toHaveBeenCalledWith('draw-1', { title: 'Updated' });
  });

  test('returns 404 for non-existent drawing', async () => {
    const service = createMockService();
    const app = createTestApp(service);
    const res = await request(app, 'PATCH', '/api/drawings/nonexistent', { title: 'X' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/drawings/:id', () => {
  test('deletes an existing drawing', async () => {
    const service = createMockService({ delete: jest.fn().mockReturnValue(true) });
    const app = createTestApp(service);
    const res = await request(app, 'DELETE', '/api/drawings/draw-1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(service.delete).toHaveBeenCalledWith('draw-1');
  });

  test('returns 404 for non-existent drawing', async () => {
    const service = createMockService();
    const app = createTestApp(service);
    const res = await request(app, 'DELETE', '/api/drawings/nonexistent');

    expect(res.status).toBe(404);
  });
});
