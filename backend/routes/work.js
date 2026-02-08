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
      priorities: [
        {
          title: 'Monitor OpenClaw agents',
          details:
            'Check heartbeat status for all connected agents. Verify reconnect policies are working and review any agents that have gone offline in the last 24 hours.',
        },
        {
          title: 'Review task queue',
          details:
            'Audit pending and in-progress tasks. Identify any stalled items and reassign or escalate as needed. Clear completed tasks older than 7 days.',
        },
        {
          title: 'Check budget trends',
          details:
            'Review spending vs. forecast for the current month. Flag any categories that are over 80% of their allocated budget and note upcoming bills.',
        },
      ],
      blockers: [],
    });
  });

  return router;
};
