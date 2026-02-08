const express = require('express');
const { requireAuth } = require('../middleware/auth');

module.exports = function (agentService, heartbeatService) {
  const router = express.Router();

  router.get('/status', (req, res) => {
    res.json(agentService.getAll());
  });

  router.get('/heartbeat', (req, res) => {
    res.json(heartbeatService.getHeartbeatTimings());
  });

  router.post('/status', requireAuth, (req, res) => {
    const { id, name, status, metadata } = req.body;
    if (!id) return res.status(400).json({ error: 'id is required' });
    const agent = agentService.upsert({ id, name, status, metadata });
    res.json(agent);
  });

  router.post('/heartbeat', requireAuth, (req, res) => {
    const { agentId, agentName, status, message, systemHealth, tasks, heartbeatInterval } = req.body;
    if (!agentId) return res.status(400).json({ error: 'agentId is required' });
    const heartbeat = heartbeatService.record({ agentId, agentName, status, message, systemHealth, tasks, heartbeatInterval });
    res.json(heartbeat);
  });

  return router;
};
