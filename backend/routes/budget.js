const express = require('express');
const router = express.Router();

router.get('/summary', (req, res) => {
  res.json({
    month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
    totalSpent: 2847.50,
    budget: 4000,
    remaining: 1152.50,
    categories: [
      { name: 'Housing', spent: 1200, budget: 1200 },
      { name: 'Food', spent: 487.30, budget: 600 },
      { name: 'Transport', spent: 215.00, budget: 300 },
      { name: 'Subscriptions', spent: 89.99, budget: 100 },
      { name: 'Other', spent: 855.21, budget: 1800 },
    ],
  });
});

router.get('/trends', (req, res) => {
  const months = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'];
  res.json(months.map((m, i) => ({
    month: m,
    spent: 2500 + Math.round(Math.random() * 1000),
    budget: 4000,
  })));
});

router.get('/upcoming-bills', (req, res) => {
  const now = new Date();
  res.json([
    { name: 'Rent', amount: 1200, dueDate: new Date(now.getFullYear(), now.getMonth(), 28).toISOString(), recurring: true },
    { name: 'Internet', amount: 65, dueDate: new Date(now.getFullYear(), now.getMonth(), 15).toISOString(), recurring: true },
    { name: 'Phone', amount: 45, dueDate: new Date(now.getFullYear(), now.getMonth(), 20).toISOString(), recurring: true },
  ]);
});

module.exports = router;
