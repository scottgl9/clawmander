const express = require('express');

module.exports = function (memoryService) {
  const router = express.Router();

  router.get('/weeks', (req, res) => {
    const limit = parseInt(req.query.limit) || 12;
    const weeks = memoryService.getAvailableWeeks(limit);
    res.json(weeks);
  });

  router.get('/weeks/:weekId', (req, res) => {
    const data = memoryService.getWeekSummaries(req.params.weekId);
    res.json(data);
  });

  router.get('/weeks/:weekId/:agent', (req, res) => {
    const content = memoryService.getWeekMd(req.params.agent, req.params.weekId);
    if (content === null) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json({ weekId: req.params.weekId, agent: req.params.agent, content });
  });

  return router;
};
