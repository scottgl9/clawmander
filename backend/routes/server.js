const express = require('express');

module.exports = function serverRoutes(serverStatusService) {
  const router = express.Router();

  router.get('/status', (req, res) => {
    res.json(serverStatusService.getStatus());
  });

  return router;
};
