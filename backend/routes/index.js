const agentsRoutes = require('./agents');
const tasksRoutes = require('./tasks');
const workRoutes = require('./work');
const budgetRoutes = require('./budget');
const jobsRoutes = require('./jobs');
const viewsRoutes = require('./views');
const activityRoutes = require('./activity');
const sseRoutes = require('./sse');
const serverRoutes = require('./server');
const chatRoutes = require('./chat');
const cronRoutes = require('./cron');
const feedsRoutes = require('./feeds');
const memoryRoutes = require('./memory');
const drawingsRoutes = require('./drawings');
const voiceRoutes = require('./voice');
const authRoutes = require('./auth');
const { browserRoutes } = require('./browser');
const gatewayRoutes = require('./gateway');
const approvalsRoutes = require('./approvals');
const smsRoutes = require('./sms');

module.exports = function mountRoutes(app, services) {
  const { taskService, agentService, heartbeatService, budgetService, actionItemService, sseManager, serverStatusService, chatGatewayClient, chatService, cronService, memoryService, drawingService, config, authDB, browserManager, openClawCLI, smsGatewayService, messageModel } = services;

  // Auth routes (no auth required — handles its own)
  app.use('/api/auth', authRoutes(authDB, config));

  app.use('/api/agents', agentsRoutes(agentService, heartbeatService));

  // POST /api/agents/tasks -> create task (kept under /api/agents for OpenClaw compatibility)
  const { requireAuth } = require('../middleware/auth');
  const anyAuth = require('../middleware/anyAuth');
  app.post('/api/agents/tasks', anyAuth, (req, res) => {
    const { agentId, task } = req.body;
    const taskData = { ...task, agentId: agentId || task?.agentId };
    const result = taskService.upsert(taskData);
    res.status(result.created ? 201 : 200).json(result.task);
  });

  app.use('/api/tasks', tasksRoutes(taskService));
  app.use('/api/work', workRoutes(actionItemService));
  app.use('/api/budget', budgetRoutes(budgetService));
  app.use('/api/jobs', jobsRoutes);
  app.use('/api/views', viewsRoutes(taskService, agentService, actionItemService));
  app.use('/api/activity', activityRoutes);
  app.use('/api/sse', sseRoutes(sseManager));
  app.use('/api/server', serverRoutes(serverStatusService));
  app.use('/api/chat', chatRoutes(chatGatewayClient, chatService));
  app.use('/api/cron', cronRoutes(cronService));
  app.use('/api/feeds', feedsRoutes(cronService));
  app.use('/api/memory', memoryRoutes(memoryService));
  app.use('/api/drawings', drawingsRoutes(drawingService));
  app.use('/api/voice', voiceRoutes(config));
  app.use('/api/browser', browserRoutes(browserManager));
  app.use('/api/gateway', gatewayRoutes());
  app.use('/api/approvals', approvalsRoutes(openClawCLI));
  app.use('/api/sms', smsRoutes(smsGatewayService, messageModel));
};
