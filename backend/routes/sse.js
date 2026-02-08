const express = require('express');

module.exports = function (sseManager) {
  const router = express.Router();

  router.get('/subscribe', (req, res) => {
    sseManager.addClient(res);
  });

  return router;
};
