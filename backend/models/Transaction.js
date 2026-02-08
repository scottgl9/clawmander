const { v4: uuidv4 } = require('uuid');

function createTransaction({ categoryId, amount, description, date, merchant, metadata }) {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    categoryId: categoryId || null,
    amount: typeof amount === 'number' ? amount : 0,
    description: description || '',
    date: date || now,
    merchant: merchant || '',
    metadata: metadata || {},
    createdAt: now,
  };
}

module.exports = { createTransaction };
