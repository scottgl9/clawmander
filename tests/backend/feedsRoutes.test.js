const express = require('express');
const http = require('http');
const feedsRoutes = require('../../backend/routes/feeds');

function createTestApp(cronService) {
  const app = express();
  app.use('/api/feeds', feedsRoutes(cronService));
  return app;
}

function request(app, urlPath) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      http.get(`http://127.0.0.1:${port}${urlPath}`, (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => {
          server.close();
          try {
            resolve({ status: res.statusCode, body: JSON.parse(body) });
          } catch {
            resolve({ status: res.statusCode, body });
          }
        });
      }).on('error', (err) => { server.close(); reject(err); });
    });
  });
}

const fakeResult = {
  total: 50,
  offset: 0,
  limit: 25,
  runs: [
    { ts: new Date(1773000000000).toISOString(), tsMs: 1773000000000, jobId: 'job-1', agentId: 'budget', status: 'ok', summary: '## Budget\nAll good.' },
    { ts: new Date(1772900000000).toISOString(), tsMs: 1772900000000, jobId: 'job-2', agentId: 'work-agent', status: 'ok', summary: '## Brief\nGood morning.' },
  ],
};

describe('GET /api/feeds', () => {
  test('returns feed with default params', async () => {
    const mockService = { getAllRuns: jest.fn().mockReturnValue(fakeResult) };
    const res = await request(createTestApp(mockService), '/api/feeds');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(50);
    expect(res.body.runs).toHaveLength(2);
    expect(mockService.getAllRuns).toHaveBeenCalledWith(50, 0, null);
  });

  test('passes limit and offset query params', async () => {
    const mockService = { getAllRuns: jest.fn().mockReturnValue({ total: 0, offset: 10, limit: 5, runs: [] }) };
    await request(createTestApp(mockService), '/api/feeds?limit=5&offset=10');
    expect(mockService.getAllRuns).toHaveBeenCalledWith(5, 10, null);
  });

  test('passes agent filter query param', async () => {
    const mockService = { getAllRuns: jest.fn().mockReturnValue({ total: 1, offset: 0, limit: 50, runs: [] }) };
    await request(createTestApp(mockService), '/api/feeds?agent=budget');
    expect(mockService.getAllRuns).toHaveBeenCalledWith(50, 0, 'budget');
  });

  test('passes null agent when not specified', async () => {
    const mockService = { getAllRuns: jest.fn().mockReturnValue({ total: 0, offset: 0, limit: 50, runs: [] }) };
    await request(createTestApp(mockService), '/api/feeds');
    const [, , agentArg] = mockService.getAllRuns.mock.calls[0];
    expect(agentArg).toBeNull();
  });

  test('returns correct structure', async () => {
    const mockService = { getAllRuns: jest.fn().mockReturnValue(fakeResult) };
    const res = await request(createTestApp(mockService), '/api/feeds');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('offset');
    expect(res.body).toHaveProperty('limit');
    expect(res.body).toHaveProperty('runs');
    expect(Array.isArray(res.body.runs)).toBe(true);
  });
});
