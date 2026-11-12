const { v4: uuidv4 } = require('uuid');

// A detected recurring charge / subscription for a given month. Posted by the
// budget agent's detect-recurring.py via PUT /api/budget/subscriptions.
function createSubscription(data = {}) {
  const now = new Date().toISOString();
  return {
    id: data.id || uuidv4(),
    month: data.month || new Date().toISOString().slice(0, 7),
    merchantKey: data.merchantKey || '',
    merchant: data.merchant || '',
    category: data.category || 'Other',
    isSubscription: data.isSubscription !== false,
    cadence: data.cadence || null,
    intervalDays: typeof data.intervalDays === 'number' ? data.intervalDays : null,
    amount: typeof data.amount === 'number' ? data.amount : 0,
    latestAmount: typeof data.latestAmount === 'number' ? data.latestAmount : (data.amount || 0),
    monthlyEquivalent: typeof data.monthlyEquivalent === 'number' ? data.monthlyEquivalent : 0,
    annualizedCost: typeof data.annualizedCost === 'number' ? data.annualizedCost : 0,
    occurrences: typeof data.occurrences === 'number' ? data.occurrences : 0,
    firstSeen: data.firstSeen || null,
    lastCharge: data.lastCharge || null,
    predictedNextCharge: data.predictedNextCharge || null,
    serviceGroup: data.serviceGroup || null,
    status: data.status || 'active', // active | lapsed | keep | cancel | ignore
    flags: data.flags || {},
    notes: data.notes || '',
    updatedAt: now,
  };
}

module.exports = { createSubscription };
