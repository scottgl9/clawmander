const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config/config');
const SSEManager = require('./services/SSEManager');
const AgentService = require('./services/AgentService');
const TaskService = require('./services/TaskService');
const HeartbeatService = require('./services/HeartbeatService');
const OpenClawCollector = require('./collectors/OpenClawCollector');
const mountRoutes = require('./routes');
const { activityLogger } = require('./middleware/logger');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(activityLogger);

// Services
const sseManager = new SSEManager();
const agentService = new AgentService(sseManager);
const taskService = new TaskService(sseManager);
const heartbeatService = new HeartbeatService(sseManager, agentService);

// Routes
mountRoutes(app, { taskService, agentService, heartbeatService, sseManager });

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), sseClients: sseManager.clientCount });
});

// Seed data when in test mode
if (config.testMode) {
  const FileStore = require('./storage/FileStore');
  const seedStore = new FileStore('agents.json');
  if (seedStore.read().length === 0) {
    console.log('[Test Mode] Populating sample data...');
    const { createAgent } = require('./models/Agent');
    const { createTask } = require('./models/Task');

    const agents = [
      createAgent({ id: 'whatsapp-agent', name: 'WhatsApp Agent', status: 'active', heartbeatInterval: 300 }),
      createAgent({ id: 'telegram-agent', name: 'Telegram Agent', status: 'idle', heartbeatInterval: 300 }),
      createAgent({ id: 'discord-agent', name: 'Discord Agent', status: 'active', heartbeatInterval: 180 }),
      createAgent({ id: 'job-search-agent', name: 'Job Search Agent', status: 'offline', heartbeatInterval: 600 }),
    ];
    const agentStore = new FileStore('agents.json');
    agentStore.write(agents);

    const tasks = [
      createTask({ title: 'Monitor WhatsApp group', description: 'Watch for incoming messages', status: 'in_progress', priority: 'high', agentId: 'whatsapp-agent', progress: 65, tags: ['monitoring'] }),
      createTask({ title: 'Process Telegram queue', description: 'Handle pending Telegram messages', status: 'queued', priority: 'medium', agentId: 'telegram-agent', tags: ['queue'] }),
      createTask({ title: 'Discord bot maintenance', description: 'Update Discord bot permissions', status: 'in_progress', priority: 'medium', agentId: 'discord-agent', progress: 30, tags: ['maintenance'] }),
      createTask({ title: 'Scrape job listings', description: 'Search for new Austin/Remote positions', status: 'done', priority: 'low', agentId: 'job-search-agent', progress: 100, tags: ['jobs'] }),
      createTask({ title: 'Resume parsing', description: 'Parse uploaded resumes for matching', status: 'blocked', priority: 'high', agentId: 'job-search-agent', tags: ['jobs', 'blocked'] }),
      createTask({ title: 'Send daily digest', description: 'Compile and send daily summary', status: 'queued', priority: 'critical', agentId: 'whatsapp-agent', tags: ['daily'] }),
    ];
    const taskStore = new FileStore('tasks.json');
    taskStore.write(tasks);
  }
} else {
  console.log('[Production Mode] Starting with empty data store');
}

// Start OpenClaw collector
const collector = new OpenClawCollector(agentService, sseManager);
collector.start();

// Start server
app.listen(config.port, () => {
  console.log(`[Clawmander] Backend running on port ${config.port}`);
  console.log(`[Clawmander] SSE endpoint: http://localhost:${config.port}/api/sse/subscribe`);
});
