const express = require('express');

module.exports = function (taskService, agentService) {
  const router = express.Router();

  router.get('/daily', (req, res) => {
    const tasks = taskService.getAll();
    const agents = agentService.getAll();
    const today = new Date().toISOString().split('T')[0];
    const todayTasks = tasks.filter((t) => t.createdAt?.startsWith(today) || t.status === 'in_progress');
    res.json({
      date: today,
      tasks: todayTasks,
      agents,
      stats: taskService.getStats(),
    });
  });

  router.get('/weekly', (req, res) => {
    const tasks = taskService.getAll();
    const agents = agentService.getAll();
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const weekTasks = tasks.filter((t) => t.createdAt >= weekAgo);
    res.json({
      startDate: weekAgo.split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      tasks: weekTasks,
      agents,
      stats: taskService.getStats(),
      completedThisWeek: weekTasks.filter((t) => t.status === 'done').length,
    });
  });

  router.get('/monthly', (req, res) => {
    const tasks = taskService.getAll();
    const agents = agentService.getAll();
    const monthStart = new Date();
    monthStart.setDate(1);
    const monthTasks = tasks.filter((t) => t.createdAt >= monthStart.toISOString());
    res.json({
      month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
      tasks: monthTasks,
      agents,
      stats: taskService.getStats(),
      completedThisMonth: monthTasks.filter((t) => t.status === 'done').length,
    });
  });

  return router;
};
