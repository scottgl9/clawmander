const fs = require('fs');
const os = require('os');
const path = require('path');

describe('BudgetService subscriptions & bills', () => {
  let tempDir;
  let BudgetService;
  let service;

  const sub = (over = {}) => ({
    merchantKey: 'netflix',
    merchant: 'Netflix',
    category: 'Subscriptions',
    isSubscription: true,
    cadence: 'monthly',
    amount: 27.05,
    monthlyEquivalent: 27.05,
    annualizedCost: 324.6,
    predictedNextCharge: '2026-07-13',
    flags: {},
    ...over,
  });

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawmander-subs-'));
    process.env.CLAWMANDER_DATA_DIR = tempDir;
    jest.resetModules();
    BudgetService = require('../../backend/services/BudgetService');
    service = new BudgetService({ broadcast: jest.fn() });
  });

  afterEach(() => {
    delete process.env.CLAWMANDER_DATA_DIR;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('replaceSubscriptions stores per-month and replaces in place', () => {
    service.replaceSubscriptions('2026-06', [sub(), sub({ merchantKey: 'canva', merchant: 'Canva', monthlyEquivalent: 14.99 })]);
    expect(service.getSubscriptions('2026-06')).toHaveLength(2);

    // Replacing the same month swaps the set, not appends.
    service.replaceSubscriptions('2026-06', [sub()]);
    expect(service.getSubscriptions('2026-06')).toHaveLength(1);
  });

  test('summary excludes lapsed/cancelled from active totals', () => {
    service.replaceSubscriptions('2026-06', [
      sub(),
      sub({ merchantKey: 'kindle', merchant: 'Kindle', monthlyEquivalent: 12.98, flags: { lapsed: true } }),
      sub({ merchantKey: 'hbo', merchant: 'HBO', monthlyEquivalent: 18.13, status: 'cancel' }),
    ]);
    const summary = service.getSubscriptionSummary('2026-06');
    expect(summary.count).toBe(3);
    expect(summary.activeCount).toBe(1);
    expect(summary.lapsedCount).toBe(1);
    expect(summary.totalMonthly).toBe(27.05);
  });

  test('trends include strict per-month subscription cost (no fallback bleed)', () => {
    service.replaceSubscriptions('2026-06', [sub()]);
    // 2026-05 intentionally has no subscriptions snapshot.
    const trends = service.getTrends(2, '2026-06');
    const may = trends.find((t) => t.monthKey === '2026-05');
    const jun = trends.find((t) => t.monthKey === '2026-06');
    expect(may.subscriptionCost).toBe(0);
    expect(jun.subscriptionCost).toBe(27.05);
  });

  test('replaceBills writes normalized bill rows', () => {
    const rows = service.replaceBills([
      { name: 'Netflix', amount: 27.05, dueDate: '2026-07-13', category: 'Subscriptions' },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: 'Netflix', amount: 27.05, source: 'budget-agent' });
  });
});
