const fs = require('fs');
const os = require('os');
const path = require('path');

describe('BudgetService', () => {
  let tempDir;
  let BudgetService;
  let service;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawmander-budget-'));
    process.env.CLAWMANDER_DATA_DIR = tempDir;
    jest.resetModules();
    BudgetService = require('../../backend/services/BudgetService');
    service = new BudgetService({ broadcast: jest.fn() });
  });

  afterEach(() => {
    delete process.env.CLAWMANDER_DATA_DIR;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('anchors trends to the requested end month', () => {
    service.createCategory({ name: 'Groceries', budget: 100, spent: 90, month: '2026-02' });
    service.createCategory({ name: 'Groceries', budget: 100, spent: 80, month: '2026-03' });
    service.createCategory({ name: 'Groceries', budget: 100, spent: 70, month: '2026-04' });
    service.createCategory({ name: 'Groceries', budget: 100, spent: 60, month: '2026-05' });

    const trends = service.getTrends(3, '2026-04');

    expect(trends.map((row) => row.monthKey)).toEqual(['2026-02', '2026-03', '2026-04']);
    expect(trends.map((row) => row.spent)).toEqual([90, 80, 70]);
  });

  test('falls back to the current month when endMonth is invalid', () => {
    const trends = service.getTrends(2, 'bad-input');

    expect(trends).toHaveLength(2);
    expect(trends[1].monthKey).toMatch(/^\d{4}-\d{2}$/);
  });
});
