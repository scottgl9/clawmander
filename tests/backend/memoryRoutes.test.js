const express = require('express');
const http = require('http');
const memoryRoutes = require('../../backend/routes/memory');

function createTestApp(memoryService) {
  const app = express();
  app.use('/api/memory', memoryRoutes(memoryService));
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

const fakeWeeks = [
  { weekId: '2026-W09', agents: ['work-agent', 'personal-agent', 'budget'], agentCount: 3 },
  { weekId: '2026-W08', agents: ['work-agent', 'personal-agent'], agentCount: 2 },
];

const fakeWeekData = {
  weekId: '2026-W09',
  agents: ['work-agent', 'budget'],
  summaries: {
    'work-agent': '# Work Week\nDid a lot.',
    'budget': '# Budget Week\nSpent $200.',
  },
};

describe('GET /api/memory/weeks', () => {
  test('returns available weeks with default limit', async () => {
    const mockService = { getAvailableWeeks: jest.fn().mockReturnValue(fakeWeeks) };
    const res = await request(createTestApp(mockService), '/api/memory/weeks');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].weekId).toBe('2026-W09');
    expect(mockService.getAvailableWeeks).toHaveBeenCalledWith(12);
  });

  test('passes limit query param', async () => {
    const mockService = { getAvailableWeeks: jest.fn().mockReturnValue([]) };
    await request(createTestApp(mockService), '/api/memory/weeks?limit=4');
    expect(mockService.getAvailableWeeks).toHaveBeenCalledWith(4);
  });

  test('returns empty array when no weeks', async () => {
    const mockService = { getAvailableWeeks: jest.fn().mockReturnValue([]) };
    const res = await request(createTestApp(mockService), '/api/memory/weeks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('GET /api/memory/weeks/:weekId', () => {
  test('returns week summaries for all agents', async () => {
    const mockService = { getWeekSummaries: jest.fn().mockReturnValue(fakeWeekData) };
    const res = await request(createTestApp(mockService), '/api/memory/weeks/2026-W09');
    expect(res.status).toBe(200);
    expect(res.body.weekId).toBe('2026-W09');
    expect(res.body.agents).toContain('work-agent');
    expect(res.body.summaries['work-agent']).toBe('# Work Week\nDid a lot.');
    expect(mockService.getWeekSummaries).toHaveBeenCalledWith('2026-W09');
  });

  test('passes weekId correctly to service', async () => {
    const mockService = { getWeekSummaries: jest.fn().mockReturnValue({ weekId: '2026-W08', agents: [], summaries: {} }) };
    await request(createTestApp(mockService), '/api/memory/weeks/2026-W08');
    expect(mockService.getWeekSummaries).toHaveBeenCalledWith('2026-W08');
  });
});

describe('GET /api/memory/weeks/:weekId/:agent', () => {
  test('returns specific agent WEEK.md content', async () => {
    const mockService = { getWeekMd: jest.fn().mockReturnValue('# Work Week content') };
    const res = await request(createTestApp(mockService), '/api/memory/weeks/2026-W09/work-agent');
    expect(res.status).toBe(200);
    expect(res.body.weekId).toBe('2026-W09');
    expect(res.body.agent).toBe('work-agent');
    expect(res.body.content).toBe('# Work Week content');
    expect(mockService.getWeekMd).toHaveBeenCalledWith('work-agent', '2026-W09');
  });

  test('returns 404 when agent or week not found', async () => {
    const mockService = { getWeekMd: jest.fn().mockReturnValue(null) };
    const res = await request(createTestApp(mockService), '/api/memory/weeks/2026-W01/unknown-agent');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });

  test('passes agent and weekId correctly to service', async () => {
    const mockService = { getWeekMd: jest.fn().mockReturnValue('content') };
    await request(createTestApp(mockService), '/api/memory/weeks/2026-W07/budget');
    expect(mockService.getWeekMd).toHaveBeenCalledWith('budget', '2026-W07');
  });
});
