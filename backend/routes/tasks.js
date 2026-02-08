const express = require('express');
const { requireAuth } = require('../middleware/auth');

module.exports = function (taskService) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const { status, agentId } = req.query;
    res.json(taskService.getAll({ status, agentId }));
  });

  router.get('/stats', (req, res) => {
    res.json(taskService.getStats());
  });

  router.get('/:taskId', (req, res) => {
    const task = taskService.getById(req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  });

  router.post('/', requireAuth, (req, res) => {
    const task = taskService.create(req.body);
    res.status(201).json(task);
  });

  router.patch('/:taskId', requireAuth, (req, res) => {
    try {
      const task = taskService.update(req.params.taskId, req.body);
      if (!task) return res.status(404).json({ error: 'Task not found' });
      res.json(task);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.delete('/:taskId', requireAuth, (req, res) => {
    const removed = taskService.delete(req.params.taskId);
    if (!removed) return res.status(404).json({ error: 'Task not found' });
    res.json({ success: true });
  });

  return router;
};
