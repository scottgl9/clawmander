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
    const endMonth = req.query.endMonth;
    res.json(budgetService.getTrends(months, endMonth));
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

  router.get('/status', (req, res) => {
    const month = req.query.month;
    res.json(budgetService.getStatus(month));
  });

  router.get('/balances', (req, res) => {
    const month = req.query.month;
    res.json(budgetService.getBalances(month));
  });

  // Subscriptions (read — public)
  router.get('/subscriptions', (req, res) => {
    const month = req.query.month;
    res.json({
      month: month || new Date().toISOString().slice(0, 7),
      summary: budgetService.getSubscriptionSummary(month),
      sinkingFunds: budgetService.getSinkingFunds(month),
      subscriptions: budgetService.getSubscriptions(month),
    });
  });

  // Net worth (liquid cash position) trend
  router.get('/networth', (req, res) => {
    const limit = parseInt(req.query.limit || '12', 10);
    res.json(budgetService.getNetworth(limit));
  });

  // Upcoming bills
  router.get('/upcoming-bills', (req, res) => {
    const FileStore = require('../storage/FileStore');
    const billsStore = new FileStore('bills.json');
    const bills = billsStore.read();
    
    // Filter to upcoming bills (within next 30 days)
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    const upcomingBills = bills
      .filter(bill => {
        const dueDate = new Date(bill.dueDate);
        return dueDate >= now && dueDate <= thirtyDaysFromNow;
      })
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    
    res.json(upcomingBills);
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

  router.patch('/status', requireAuth, (req, res) => {
    const updated = budgetService.upsertStatus(req.body || {});
    res.json(updated);
  });

  router.patch('/balances', requireAuth, (req, res) => {
    const month = req.body && req.body.month;
    const updated = budgetService.upsertBalances(month, req.body || {});
    res.json(updated);
  });

  // Bulk-replace detected subscriptions for a month (agent sync)
  router.put('/subscriptions', requireAuth, (req, res) => {
    const month = req.body && req.body.month;
    const items = (req.body && req.body.subscriptions) || [];
    const created = budgetService.replaceSubscriptions(month, items);
    res.json({ month: month || new Date().toISOString().slice(0, 7), count: created.length });
  });

  // Bulk-replace auto-derived bills (agent sync)
  router.put('/bills', requireAuth, (req, res) => {
    const items = (req.body && req.body.bills) || [];
    const rows = budgetService.replaceBills(items);
    res.json({ count: rows.length });
  });

  // Record a net-worth snapshot for a month (agent sync)
  router.put('/networth', requireAuth, (req, res) => {
    const saved = budgetService.recordNetworth(req.body || {});
    res.json(saved);
  });

  return router;
};
