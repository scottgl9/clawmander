const { v4: uuidv4 } = require('uuid');

function createBudgetCategory({ name, budget, spent, month, metadata }) {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    name: name || 'Uncategorized',
    budget: typeof budget === 'number' ? budget : 0,
    spent: typeof spent === 'number' ? spent : 0,
    month: month || new Date().toISOString().slice(0, 7), // YYYY-MM format
    metadata: metadata || {},
    createdAt: now,
    updatedAt: now,
  };
}

module.exports = { createBudgetCategory };
