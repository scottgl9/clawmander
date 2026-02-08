const express = require('express');
const router = express.Router();

router.get('/action-items', (req, res) => {
  res.json([
    { id: 1, title: 'Review OpenClaw agent configs', priority: 'high', done: false },
    { id: 2, title: 'Update resume for Austin roles', priority: 'medium', done: false },
    { id: 3, title: 'Check Lunchflow budget alerts', priority: 'low', done: true },
  ]);
});

router.get('/brief', (req, res) => {
  res.json({
    date: new Date().toISOString().split('T')[0],
    summary: 'Focus on agent monitoring and dashboard polish.',
    priorities: ['Monitor OpenClaw agents', 'Review task queue', 'Check budget trends'],
    blockers: [],
  });
});

module.exports = router;
