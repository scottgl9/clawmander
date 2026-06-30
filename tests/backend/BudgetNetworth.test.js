const fs = require('fs');
const os = require('os');
const path = require('path');

describe('BudgetService net worth', () => {
  let tempDir;
  let BudgetService;
  let service;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawmander-nw-'));
    process.env.CLAWMANDER_DATA_DIR = tempDir;
    jest.resetModules();
    BudgetService = require('../../backend/services/BudgetService');
    service = new BudgetService({ broadcast: jest.fn() });
  });

  afterEach(() => {
    delete process.env.CLAWMANDER_DATA_DIR;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('records and computes net worth from components', () => {
    const saved = service.recordNetworth({ month: '2026-06', checking: 5000, savings: 12000, cardDebt: 800 });
    expect(saved.netWorth).toBe(16200);
  });

  test('upserts in place per month and returns sorted series', () => {
    service.recordNetworth({ month: '2026-05', netWorth: 14000, checking: 4000, savings: 10000, cardDebt: 0 });
    service.recordNetworth({ month: '2026-06', netWorth: 15000, checking: 4500, savings: 10500, cardDebt: 0 });
    service.recordNetworth({ month: '2026-06', netWorth: 16000, checking: 5000, savings: 11000, cardDebt: 0 });

    const series = service.getNetworth();
    expect(series.map((r) => r.month)).toEqual(['2026-05', '2026-06']);
    expect(series[1].netWorth).toBe(16000); // latest snapshot for the month wins
  });

  test('limit returns the most recent N months', () => {
    ['2026-01', '2026-02', '2026-03'].forEach((m, i) =>
      service.recordNetworth({ month: m, netWorth: 1000 * (i + 1), checking: 0, savings: 0, cardDebt: 0 }));
    const series = service.getNetworth(2);
    expect(series.map((r) => r.month)).toEqual(['2026-02', '2026-03']);
  });
});
