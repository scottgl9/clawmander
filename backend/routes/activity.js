const express = require('express');
const { activityStore } = require('../middleware/logger');
const { createActivityLog } = require('../models/ActivityLog');

const router = express.Router();

router.get('/log', (req, res) => {
  const limit = parseInt(req.query.limit || '50', 10);
  const offset = parseInt(req.query.offset || '0', 10);
  const type = req.query.type;

  let logs = activityStore.read();
  if (type) logs = logs.filter((l) => l.type === type);
  logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const total = logs.length;
  const items = logs.slice(offset, offset + limit);
  res.json({ total, offset, limit, items });
});

router.post('/log', (req, res) => {
  const entry = createActivityLog(req.body);
  activityStore.insert(entry);
  res.status(201).json(entry);
});

module.exports = router;
