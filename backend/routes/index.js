const agentsRoutes = require('./agents');
const tasksRoutes = require('./tasks');
const workRoutes = require('./work');
const budgetRoutes = require('./budget');
const jobsRoutes = require('./jobs');
const viewsRoutes = require('./views');
const activityRoutes = require('./activity');
const sseRoutes = require('./sse');

module.exports = function mountRoutes(app, services) {
  const { taskService, agentService, heartbeatService, budgetService, sseManager } = services;

  app.use('/api/agents', agentsRoutes(agentService, heartbeatService));

  // POST /api/agents/tasks -> create task (kept under /api/agents for OpenClaw compatibility)
  const { requireAuth } = require('../middleware/auth');
  app.post('/api/agents/tasks', requireAuth, (req, res) => {
    const { agentId, task } = req.body;
    const taskData = { ...task, agentId: agentId || task?.agentId };
    const created = taskService.create(taskData);
    res.status(201).json(created);
  });

  app.use('/api/tasks', tasksRoutes(taskService));
  app.use('/api/work', workRoutes);
  app.use('/api/budget', budgetRoutes(budgetService));
  app.use('/api/jobs', jobsRoutes);
  app.use('/api/views', viewsRoutes(taskService, agentService));
  app.use('/api/activity', activityRoutes);
  app.use('/api/sse', sseRoutes(sseManager));
};
