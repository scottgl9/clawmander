const express = require('express');
const { requireAuth } = require('../middleware/auth');

module.exports = function (budgetService) {
  const router = express.Router();

  // Read endpoints
  router.get('/summary', (req, res) => {
    const month = req.query.month;
    res.json(budgetService.getSummary(month));
  });

  router.get('/trends', (req, res) => {
    const months = parseInt(req.query.months || '6', 10);
    res.json(budgetService.getTrends(months));
  });

  router.get('/categories', (req, res) => {
    const month = req.query.month;
    res.json(budgetService.getAllCategories(month));
  });

  router.get('/categories/:id', (req, res) => {
    const category = budgetService.getCategoryById(req.params.id);
    if (!category) return res.status(404).json({ error: 'Category not found' });
    res.json(category);
  });

  router.get('/transactions', (req, res) => {
    const { categoryId, startDate, endDate } = req.query;
    res.json(budgetService.getAllTransactions(categoryId, startDate, endDate));
  });

  router.get('/transactions/:id', (req, res) => {
    const transaction = budgetService.getTransactionById(req.params.id);
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    res.json(transaction);
  });

  // Placeholder - upcoming bills (future enhancement)
  router.get('/upcoming-bills', (req, res) => {
    const now = new Date();
    res.json([
      { name: 'Rent', amount: 1200, dueDate: new Date(now.getFullYear(), now.getMonth(), 28).toISOString(), recurring: true },
      { name: 'Internet', amount: 65, dueDate: new Date(now.getFullYear(), now.getMonth(), 15).toISOString(), recurring: true },
      { name: 'Phone', amount: 45, dueDate: new Date(now.getFullYear(), now.getMonth(), 20).toISOString(), recurring: true },
    ]);
  });

  // Write endpoints (require auth)
  router.post('/categories', requireAuth, (req, res) => {
    const category = budgetService.createCategory(req.body);
    res.status(201).json(category);
  });

  router.patch('/categories/:id', requireAuth, (req, res) => {
    const category = budgetService.updateCategory(req.params.id, req.body);
    if (!category) return res.status(404).json({ error: 'Category not found' });
    res.json(category);
  });

  router.delete('/categories/:id', requireAuth, (req, res) => {
    const removed = budgetService.deleteCategory(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Category not found' });
    res.json({ success: true });
  });

  router.post('/transactions', requireAuth, (req, res) => {
    const transaction = budgetService.createTransaction(req.body);
    res.status(201).json(transaction);
  });

  router.patch('/transactions/:id', requireAuth, (req, res) => {
    const transaction = budgetService.updateTransaction(req.params.id, req.body);
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    res.json(transaction);
  });

  router.delete('/transactions/:id', requireAuth, (req, res) => {
    const removed = budgetService.deleteTransaction(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Transaction not found' });
    res.json({ success: true });
  });

  return router;
};
