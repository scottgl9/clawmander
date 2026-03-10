const express = require('express');

module.exports = function (cronService) {
  const router = express.Router();

  router.get('/jobs', (req, res) => {
    const jobs = cronService.getJobs();
    res.json(jobs);
  });

  router.get('/jobs/:jobId/runs', (req, res) => {
    const limit = parseInt(req.query.limit) || 20;
    const runs = cronService.getRunHistory(req.params.jobId, limit);
    res.json(runs);
  });

  router.get('/system', (req, res) => {
    const system = cronService.getSystemCrons();
    res.json(system);
  });

  return router;
};
