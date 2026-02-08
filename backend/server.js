const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config/config');
const SSEManager = require('./services/SSEManager');
const AgentService = require('./services/AgentService');
const TaskService = require('./services/TaskService');
const HeartbeatService = require('./services/HeartbeatService');
const BudgetService = require('./services/BudgetService');
const ActionItemService = require('./services/ActionItemService');
const ServerStatusService = require('./services/ServerStatusService');
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
const budgetService = new BudgetService(sseManager);
const actionItemService = new ActionItemService(sseManager);
const serverStatusService = new ServerStatusService(sseManager);

// Routes
mountRoutes(app, { taskService, agentService, heartbeatService, budgetService, actionItemService, sseManager, serverStatusService });

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

    // Seed budget data
    const { createBudgetCategory } = require('./models/BudgetCategory');
    const { createTransaction } = require('./models/Transaction');
    const currentMonth = new Date().toISOString().slice(0, 7);

    const budgetCategories = [
      createBudgetCategory({ name: 'Housing', budget: 1200, spent: 1200, month: currentMonth }),
      createBudgetCategory({ name: 'Food', budget: 600, spent: 487.30, month: currentMonth }),
      createBudgetCategory({ name: 'Transport', budget: 300, spent: 215.00, month: currentMonth }),
      createBudgetCategory({ name: 'Subscriptions', budget: 100, spent: 89.99, month: currentMonth }),
      createBudgetCategory({ name: 'Other', budget: 1800, spent: 855.21, month: currentMonth }),
    ];
    const budgetCategoriesStore = new FileStore('budget-categories.json');
    budgetCategoriesStore.write(budgetCategories);

    // Sample transactions
    const transactions = [
      createTransaction({ categoryId: budgetCategories[0].id, amount: 1200, description: 'Monthly Rent', date: new Date(Date.now() - 7 * 86400000).toISOString(), merchant: 'Landlord' }),
      createTransaction({ categoryId: budgetCategories[1].id, amount: 87.43, description: 'Groceries', date: new Date(Date.now() - 1 * 86400000).toISOString(), merchant: 'Whole Foods' }),
      createTransaction({ categoryId: budgetCategories[1].id, amount: 12.50, description: 'Coffee', date: new Date(Date.now() - 2 * 86400000).toISOString(), merchant: 'Starbucks' }),
      createTransaction({ categoryId: budgetCategories[2].id, amount: 52.00, description: 'Gas', date: new Date(Date.now() - 3 * 86400000).toISOString(), merchant: 'Shell' }),
      createTransaction({ categoryId: budgetCategories[3].id, amount: 15.99, description: 'Streaming', date: new Date(Date.now() - 10 * 86400000).toISOString(), merchant: 'Netflix' }),
    ];
    const transactionsStore = new FileStore('budget-transactions.json');
    transactionsStore.write(transactions);

    // Seed action items
    const { createActionItem } = require('./models/ActionItem');
    const actionItems = [
      createActionItem({ title: 'Schedule dentist appointment', description: 'Need to book a cleaning, last visit was over 6 months ago. Call Dr. Rivera at (512) 555-0147.', priority: 'medium', done: false, category: 'personal' }),
      createActionItem({ title: 'Renew gym membership', description: 'Current membership expires end of month. Check if annual plan discount is still available.', priority: 'low', done: true, category: 'personal' }),
      createActionItem({ title: 'Call insurance company', description: 'Dispute the claim denial for the Feb visit. Reference claim #INS-2026-4412.', priority: 'high', done: false, category: 'personal' }),
      createActionItem({ title: 'Review OpenClaw agent configs', description: 'Audit heartbeat intervals and reconnect policies for all active agents. Check for any stale configs.', priority: 'high', done: false, category: 'work' }),
      createActionItem({ title: 'Update resume for Austin roles', description: 'Add recent Clawmander project experience and update skills section with Node.js/React stack.', priority: 'medium', done: false, category: 'work' }),
      createActionItem({ title: 'Check Lunchflow budget alerts', description: 'Review the February alert thresholds and verify notification delivery.', priority: 'low', done: true, category: 'work' }),
    ];
    const actionItemsStore = new FileStore('action-items.json');
    actionItemsStore.write(actionItems);
  }
} else {
  console.log('[Production Mode] Starting with empty data store');
}

// Start OpenClaw collector
// DISABLED: Current Gateway installation rejects all connection attempts
// Error: "invalid connect params: at /client/mode: must be equal to constant"
// The Gateway version/config doesn't match documented Protocol v3 spec
// Token is configured correctly (48 chars), but client.mode validation fails
// See ISSUES.md for details
// const collector = new OpenClawCollector(agentService, sseManager, serverStatusService);
// collector.start();

// Start server
app.listen(config.port, '0.0.0.0', () => {
  console.log(`[Clawmander] Backend running on 0.0.0.0:${config.port}`);
  console.log(`[Clawmander] SSE endpoint: http://localhost:${config.port}/api/sse/subscribe`);
  console.log(`[Clawmander] LAN access: http://192.168.1.104:${config.port}`);
});
