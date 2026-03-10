const express = require('express');
const http = require('http');
const cronRoutes = require('../../backend/routes/cron');

function createTestApp(cronService) {
  const app = express();
  app.use('/api/cron', cronRoutes(cronService));
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

const fakeJobs = [
  { id: 'job-1', agentId: 'budget', name: 'Budget Report', enabled: true, lastStatus: 'ok', consecutiveErrors: 0 },
  { id: 'job-2', agentId: 'work-agent', name: 'Morning Brief', enabled: false, lastStatus: 'error', consecutiveErrors: 3 },
];

const fakeRuns = [
  { ts: new Date(1773000000000).toISOString(), tsMs: 1773000000000, jobId: 'job-1', status: 'ok', summary: '## Report', durationMs: 80000 },
];

describe('GET /api/cron/jobs', () => {
  test('returns all jobs from CronService', async () => {
    const mockService = { getJobs: jest.fn().mockReturnValue(fakeJobs) };
    const res = await request(createTestApp(mockService), '/api/cron/jobs');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].id).toBe('job-1');
    expect(res.body[1].name).toBe('Morning Brief');
    expect(mockService.getJobs).toHaveBeenCalledTimes(1);
  });

  test('returns empty array when no jobs', async () => {
    const mockService = { getJobs: jest.fn().mockReturnValue([]) };
    const res = await request(createTestApp(mockService), '/api/cron/jobs');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('GET /api/cron/jobs/:jobId/runs', () => {
  test('returns run history for a job with default limit', async () => {
    const mockService = { getRunHistory: jest.fn().mockReturnValue(fakeRuns) };
    const res = await request(createTestApp(mockService), '/api/cron/jobs/job-1/runs');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].jobId).toBe('job-1');
    expect(mockService.getRunHistory).toHaveBeenCalledWith('job-1', 20);
  });

  test('passes limit query param to service', async () => {
    const mockService = { getRunHistory: jest.fn().mockReturnValue([]) };
    await request(createTestApp(mockService), '/api/cron/jobs/job-1/runs?limit=5');
    expect(mockService.getRunHistory).toHaveBeenCalledWith('job-1', 5);
  });

  test('returns empty array when no runs exist', async () => {
    const mockService = { getRunHistory: jest.fn().mockReturnValue([]) };
    const res = await request(createTestApp(mockService), '/api/cron/jobs/unknown/runs');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('GET /api/cron/system', () => {
  test('returns system cron data', async () => {
    const systemData = { crontab: [{ schedule: '0 6 * * *', command: '/usr/bin/pull.sh' }], scriptRuns: [] };
    const mockService = { getSystemCrons: jest.fn().mockReturnValue(systemData) };
    const res = await request(createTestApp(mockService), '/api/cron/system');
    expect(res.status).toBe(200);
    expect(res.body.crontab).toHaveLength(1);
    expect(res.body.scriptRuns).toEqual([]);
    expect(mockService.getSystemCrons).toHaveBeenCalledTimes(1);
  });
});
