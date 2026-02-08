const express = require('express');
const { requireAuth } = require('../middleware/auth');

module.exports = function (actionItemService) {
  const router = express.Router();

  router.get('/action-items', (req, res) => {
    const { category } = req.query;
    res.json(actionItemService.getAll(category));
  });

  router.get('/action-items/personal', (req, res) => {
    res.json(actionItemService.getPersonal());
  });

  router.get('/action-items/work', (req, res) => {
    res.json(actionItemService.getWork());
  });

  router.post('/action-items', requireAuth, (req, res) => {
    const item = actionItemService.create(req.body);
    res.status(201).json(item);
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

  router.get('/brief', (req, res) => {
    res.json({
      date: new Date().toISOString().split('T')[0],
      summary: 'Focus on agent monitoring and dashboard polish.',
      priorities: ['Monitor OpenClaw agents', 'Review task queue', 'Check budget trends'],
      blockers: [],
    });
  });

  return router;
};
