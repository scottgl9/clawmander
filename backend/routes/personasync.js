const express = require('express');
const { requireAuth } = require('../middleware/auth');

module.exports = function (personaSyncService) {
  const router = express.Router();

  // ── Sync endpoints (write, require auth) ──────────────────────────────────

  router.post('/sync/sms', requireAuth, (req, res) => {
    const items = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'Expected array' });
    const count = personaSyncService.syncSms(items);
    res.json({ count, status: 'ok' });
  });

  router.post('/sync/calendar', requireAuth, (req, res) => {
    const items = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'Expected array' });
    const count = personaSyncService.syncCalendar(items);
    res.json({ count, status: 'ok' });
  });

  router.post('/sync/health', requireAuth, (req, res) => {
    const items = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'Expected array' });
    const count = personaSyncService.syncHealth(items);
    res.json({ count, status: 'ok' });
  });

  router.post('/sync/location', requireAuth, (req, res) => {
    const items = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'Expected array' });
    const count = personaSyncService.syncLocations(items);
    res.json({ count, status: 'ok' });
  });

  router.post('/sync/contacts', requireAuth, (req, res) => {
    const items = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'Expected array' });
    const count = personaSyncService.syncContacts(items);
    res.json({ count, status: 'ok' });
  });

  router.post('/sync/call-logs', requireAuth, (req, res) => {
    const items = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'Expected array' });
    const count = personaSyncService.syncCallLogs(items);
    res.json({ count, status: 'ok' });
  });

  router.post('/sync/app-usage', requireAuth, (req, res) => {
    const items = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'Expected array' });
    const count = personaSyncService.syncAppUsage(items);
    res.json({ count, status: 'ok' });
  });

  router.post('/sync/media', requireAuth, (req, res) => {
    const items = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'Expected array' });
    const count = personaSyncService.syncMedia(items);
    res.json({ count, status: 'ok' });
  });

  // ── Command endpoint ───────────────────────────────────────────────────────

  router.post('/command', requireAuth, (req, res) => {
    const { text, agent_id } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });
    personaSyncService.saveCommand(text, agent_id || 'default');
    res.json({ status: 'ok', agent_id: agent_id || 'default' });
  });

  // ── Query endpoints (read-only, no auth) ──────────────────────────────────

  router.get('/query/summary', (req, res) => {
    res.json(personaSyncService.getSummary());
  });

  router.get('/query/counts', (req, res) => {
    res.json(personaSyncService.getCounts());
  });

  router.get('/query/sms', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 500);
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);
    res.json(personaSyncService.querySms(limit, offset));
  });

  router.get('/query/locations', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit || '100', 10), 1000);
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);
    res.json(personaSyncService.queryLocations(limit, offset));
  });

  router.get('/query/health', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit || '100', 10), 1000);
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);
    const type = req.query.type || null;
    res.json(personaSyncService.queryHealth(type, limit, offset));
  });

  return router;
};
