const express = require('express');
const { exec } = require('child_process');

module.exports = function gatewayRoutes() {
  const router = express.Router();

  // POST /api/gateway/restart — fire-and-forget restart
  router.post('/restart', (req, res) => {
    exec('openclaw gateway restart', (err) => {
      if (err) {
        console.error('[Gateway] restart command failed:', err.message);
      }
    });
    res.status(202).json({ ok: true, message: 'Gateway restart initiated.' });
  });

  // GET /api/gateway/status — simple connectivity check
  router.get('/status', (req, res) => {
    res.json({ connected: true });
  });

  return router;
};
