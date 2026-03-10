const express = require('express');

module.exports = function (cronService) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const agent = req.query.agent || null;
    const result = cronService.getAllRuns(limit, offset, agent);
    res.json(result);
  });

  return router;
};
