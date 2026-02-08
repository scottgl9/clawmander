const express = require('express');
const { requireAuth } = require('../middleware/auth');
const FileStore = require('../storage/FileStore');

module.exports = function (actionItemService) {
  const router = express.Router();
  const briefStore = new FileStore('daily-brief.json');

  // Helper to get top N items by priority
  const getTopPriority = (items, limit = 15) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return items
      .sort((a, b) => {
        const priorityDiff = (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(b.createdAt) - new Date(a.createdAt);
      })
      .slice(0, limit);
  };

  router.get('/action-items', (req, res) => {
    const { category, limit } = req.query;
    let items = actionItemService.getAll(category);
    
    if (limit) {
      items = getTopPriority(items, parseInt(limit, 10));
    }
    
    res.json(items);
  });

  router.get('/action-items/personal', (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 15;
    const items = actionItemService.getPersonal();
    res.json(getTopPriority(items, limit));
  });

  router.get('/action-items/work', (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 15;
    const items = actionItemService.getWork();
    res.json(getTopPriority(items, limit));
  });

  router.post('/action-items', requireAuth, (req, res) => {
    const result = actionItemService.upsert(req.body);
    res.status(result.created ? 201 : 200).json(result.item);
  });

  router.patch('/action-items/:id', requireAuth, (req, res) => {
    const item = actionItemService.update(req.params.id, req.body);
    if (!item) return res.status(404).json({ error: 'Action item not found' });
    res.json(item);
  });

  router.delete('/action-items/:id', requireAuth, (req, res) => {
    const removed = actionItemService.delete(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Action item not found' });
    res.json({ success: true });
  });

  // Get daily brief
  router.get('/brief', (req, res) => {
    const briefs = briefStore.read();
    const today = new Date().toISOString().split('T')[0];
    
    // Get today's brief or return default
    const todayBrief = briefs.find(b => b.date === today);
    
    if (todayBrief) {
      res.json(todayBrief);
    } else {
      res.json({
        date: today,
        summary: 'No brief generated yet for today.',
        priorities: [],
        blockers: [],
        calendar: [],
        jobs: []
      });
    }
  });

  // Update daily brief
  router.post('/brief', requireAuth, (req, res) => {
    const brief = {
      id: Date.now().toString(),
      date: req.body.date || new Date().toISOString().split('T')[0],
      summary: req.body.summary || '',
      priorities: req.body.priorities || [],
      blockers: req.body.blockers || [],
      calendar: req.body.calendar || [],
      jobs: req.body.jobs || [],
      createdAt: new Date().toISOString(),
    };
    
    // Remove old brief for the same date
    const briefs = briefStore.read();
    const existing = briefs.find(b => b.date === brief.date);
    if (existing) {
      briefStore.remove(existing.id);
    }
    
    briefStore.insert(brief);
    res.status(201).json(brief);
  });

  return router;
};
