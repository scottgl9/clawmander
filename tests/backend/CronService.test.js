const fs = require('fs');
const path = require('path');
const CronService = require('../../backend/services/CronService');

jest.mock('fs');

function mockSSE() {
  return { broadcast: jest.fn() };
}

const FAKE_HOME = '/fake/.openclaw';

const sampleJob = {
  id: 'job-1',
  agentId: 'budget',
  name: 'Budget Report',
  enabled: true,
  schedule: { kind: 'cron', expr: '0 17 * * 1,4', tz: 'America/Chicago' },
  state: {
    nextRunAtMs: 1773352800000,
    lastRunAtMs: 1773093600000,
    lastStatus: 'ok',
    lastDurationMs: 81000,
    consecutiveErrors: 0,
    lastDelivered: false,
    lastDeliveryStatus: 'not-delivered',
  },
};

const sampleJobsJson = JSON.stringify({ version: 1, jobs: [sampleJob] });

const sampleRun = {
  ts: 1773093600000,
  jobId: 'job-1',
  action: 'finished',
  status: 'ok',
  summary: '## Budget Report\n- Total balance: $5,000',
  sessionId: 'sess-abc',
  durationMs: 81000,
  model: 'haiku',
  provider: 'anthropic',
  usage: { input_tokens: 100, output_tokens: 200, total_tokens: 300 },
  delivered: false,
  deliveryStatus: 'not-delivered',
};

describe('CronService.getJobs()', () => {
  let service;

  beforeEach(() => {
    fs.readFileSync.mockImplementation((p) => {
      if (p.endsWith('jobs.json')) return sampleJobsJson;
      throw new Error('ENOENT');
    });
    service = new CronService(mockSSE(), FAKE_HOME);
  });

  test('returns array of jobs with normalized state', () => {
    const jobs = service.getJobs();
    expect(jobs).toHaveLength(1);
    const job = jobs[0];
    expect(job.id).toBe('job-1');
    expect(job.agentId).toBe('budget');
    expect(job.name).toBe('Budget Report');
    expect(job.enabled).toBe(true);
    expect(job.lastStatus).toBe('ok');
    expect(job.consecutiveErrors).toBe(0);
    expect(job.lastRun).toBe(new Date(1773093600000).toISOString());
    expect(job.nextRun).toBe(new Date(1773352800000).toISOString());
  });

  test('returns [] when jobs.json is missing', () => {
    fs.readFileSync.mockImplementation(() => { throw new Error('ENOENT'); });
    const jobs = service.getJobs();
    expect(jobs).toEqual([]);
  });

  test('returns [] when jobs.json is invalid JSON', () => {
    fs.readFileSync.mockImplementation(() => 'not-json');
    const jobs = service.getJobs();
    expect(jobs).toEqual([]);
  });
});

describe('CronService.getRunHistory()', () => {
  let service;

  beforeEach(() => {
    const jsonlLine = JSON.stringify(sampleRun);
    fs.readFileSync.mockImplementation((p) => {
      if (p.endsWith('.jsonl')) return `${jsonlLine}\n${jsonlLine}\n`;
      return sampleJobsJson;
    });
    service = new CronService(mockSSE(), FAKE_HOME);
  });

  test('returns runs in reverse chronological order', () => {
    const runs = service.getRunHistory('job-1', 10);
    expect(runs).toHaveLength(2);
    expect(runs[0].status).toBe('ok');
    expect(runs[0].summary).toBe(sampleRun.summary);
    expect(runs[0].jobId).toBe('job-1');
  });

  test('respects limit', () => {
    const jsonlLine = JSON.stringify(sampleRun);
    const lines = Array(5).fill(jsonlLine).join('\n');
    fs.readFileSync.mockImplementation(() => lines);
    const runs = service.getRunHistory('job-1', 3);
    expect(runs).toHaveLength(3);
  });

  test('returns [] when file does not exist', () => {
    fs.readFileSync.mockImplementation(() => { throw new Error('ENOENT'); });
    const runs = service.getRunHistory('nonexistent', 10);
    expect(runs).toEqual([]);
  });

  test('skips malformed JSONL lines', () => {
    fs.readFileSync.mockImplementation(() => `not-json\n${JSON.stringify(sampleRun)}\n`);
    const runs = service.getRunHistory('job-1', 10);
    expect(runs).toHaveLength(1);
  });
});

describe('CronService.getAllRuns()', () => {
  let service;

  beforeEach(() => {
    const run1 = { ...sampleRun, ts: 1000 };
    const run2 = { ...sampleRun, ts: 2000, jobId: 'job-2' };
    fs.readdirSync = jest.fn().mockReturnValue(['job-1.jsonl', 'job-2.jsonl']);
    fs.readFileSync.mockImplementation((p) => {
      if (p.endsWith('jobs.json')) return JSON.stringify({
        version: 1,
        jobs: [
          { ...sampleJob, id: 'job-1', agentId: 'budget' },
          { ...sampleJob, id: 'job-2', agentId: 'work-agent' },
        ],
      });
      if (p.includes('job-1.jsonl')) return JSON.stringify(run1);
      if (p.includes('job-2.jsonl')) return JSON.stringify(run2);
      return '';
    });
    service = new CronService(mockSSE(), FAKE_HOME);
  });

  test('aggregates runs from all files, sorted newest first', () => {
    const result = service.getAllRuns(10, 0, null);
    expect(result.total).toBe(2);
    expect(result.runs[0].tsMs).toBe(2000);
    expect(result.runs[1].tsMs).toBe(1000);
  });

  test('filters by agentId', () => {
    const result = service.getAllRuns(10, 0, 'budget');
    expect(result.total).toBe(1);
    expect(result.runs[0].agentId).toBe('budget');
  });

  test('applies offset pagination', () => {
    const result = service.getAllRuns(1, 1, null);
    expect(result.runs).toHaveLength(1);
    expect(result.runs[0].tsMs).toBe(1000);
  });

  test('includes jobName from jobs lookup', () => {
    const result = service.getAllRuns(10, 0, 'budget');
    expect(result.runs[0].jobName).toBe('Budget Report');
  });
});

describe('CronService._formatRun()', () => {
  let service;

  beforeEach(() => {
    fs.readFileSync.mockImplementation(() => sampleJobsJson);
    service = new CronService(mockSSE(), FAKE_HOME);
  });

  test('normalizes ts to ISO string', () => {
    const formatted = service._formatRun(sampleRun);
    expect(formatted.ts).toBe(new Date(1773093600000).toISOString());
    expect(formatted.tsMs).toBe(1773093600000);
  });

  test('preserves summary, status, model, usage', () => {
    const formatted = service._formatRun(sampleRun);
    expect(formatted.summary).toBe(sampleRun.summary);
    expect(formatted.status).toBe('ok');
    expect(formatted.model).toBe('haiku');
    expect(formatted.usage.total_tokens).toBe(300);
  });

  test('handles missing optional fields gracefully', () => {
    const formatted = service._formatRun({ ts: 1000, jobId: 'j', status: 'ok' });
    expect(formatted.summary).toBeNull();
    expect(formatted.error).toBeNull();
    expect(formatted.durationMs).toBeNull();
  });
});

describe('CronService.startWatcher()', () => {
  let service;
  let sse;

  beforeEach(() => {
    jest.useFakeTimers();
    sse = mockSSE();
    fs.readdirSync = jest.fn().mockReturnValue(['job-1.jsonl']);
    fs.readFileSync.mockImplementation((p) => {
      if (p.endsWith('jobs.json')) return sampleJobsJson;
      return JSON.stringify(sampleRun);
    });
    service = new CronService(sse, FAKE_HOME);
  });

  afterEach(() => {
    jest.useRealTimers();
    service.stopWatcher();
  });

  test('broadcasts feed.new and cron.status when new runs appear', () => {
    service.startWatcher();

    // Simulate a new line appearing
    fs.readFileSync.mockImplementation((p) => {
      if (p.endsWith('jobs.json')) return sampleJobsJson;
      return `${JSON.stringify(sampleRun)}\n${JSON.stringify({ ...sampleRun, ts: 9999 })}`;
    });

    jest.advanceTimersByTime(60000);

    expect(sse.broadcast).toHaveBeenCalledWith('feed.new', expect.objectContaining({ status: 'ok' }));
    expect(sse.broadcast).toHaveBeenCalledWith('cron.status', expect.objectContaining({ jobs: expect.any(Array) }));
  });
});
