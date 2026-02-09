const express = require('express');
const { requireAuth } = require('../middleware/auth');
const FileStore = require('../storage/FileStore');

module.exports = function (actionItemService) {
  const router = express.Router();
  const briefStore = new FileStore('daily-brief.json');
  const dailyTasksStore = new FileStore('daily-tasks.json');
  const weeklyTasksStore = new FileStore('weekly-tasks.json');
  const monthlyTasksStore = new FileStore('monthly-tasks.json');

  // Helper to get top N items by priority
  const getTopPriority = (items, limit = 15) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return items
      .sort((a, b) => {
        const priorityDiff = (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(b.createdAt) - new Date(a.createdAt);
      })
      .slice(0, limit);
  };

  router.get('/action-items', (req, res) => {
    const { category, limit } = req.query;
    let items = actionItemService.getAll(category);
    
    if (limit) {
      items = getTopPriority(items, parseInt(limit, 10));
    }
    
    res.json(items);
  });

  router.get('/action-items/completed', (req, res) => {
    const items = actionItemService.getAll().filter((item) => item.done === true);
    res.json(items);
  });

  router.get('/action-items/personal', (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 15;
    const items = actionItemService.getPersonal();
    res.json(getTopPriority(items, limit));
  });

  router.get('/action-items/work', (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 15;
    const items = actionItemService.getWork();
    res.json(getTopPriority(items, limit));
  });

  router.post('/action-items', requireAuth, (req, res) => {
    const result = actionItemService.upsert(req.body);
    res.status(result.created ? 201 : 200).json(result.item);
  });

  router.patch('/action-items/:id', requireAuth, (req, res) => {
    const item = actionItemService.update(req.params.id, req.body);
    if (!item) return res.status(404).json({ error: 'Action item not found' });
    res.json(item);
  });

  router.delete('/action-items/:id', requireAuth, (req, res) => {
    const removed = actionItemService.delete(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Action item not found' });
    res.json({ success: true });
  });

  // Get daily brief
  router.get('/brief', (req, res) => {
    const briefs = briefStore.read();
    const today = new Date().toISOString().split('T')[0];
    
    // Get today's brief or return default
    const todayBrief = briefs.find(b => b.date === today);
    
    if (todayBrief) {
      res.json(todayBrief);
    } else {
      res.json({
        date: today,
        summary: 'No brief generated yet for today.',
        priorities: [],
        blockers: [],
        calendar: [],
        jobs: []
      });
    }
  });

  // Update daily brief
  router.post('/brief', requireAuth, (req, res) => {
    const brief = {
      id: Date.now().toString(),
      date: req.body.date || new Date().toISOString().split('T')[0],
      summary: req.body.summary || '',
      priorities: req.body.priorities || [],
      blockers: req.body.blockers || [],
      calendar: req.body.calendar || [],
      jobs: req.body.jobs || [],
      createdAt: new Date().toISOString(),
    };

    // Remove old brief for the same date
    const briefs = briefStore.read();
    const existing = briefs.find(b => b.date === brief.date);
    if (existing) {
      briefStore.remove(existing.id);
    }

    briefStore.insert(brief);
    res.status(201).json(brief);
  });

  // Get daily tasks
  router.get('/daily-tasks', (req, res) => {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const tasks = dailyTasksStore.read();
    const dayTasks = tasks.filter(t => t.date === date);
    res.json(dayTasks);
  });

  // Create/update daily tasks
  router.post('/daily-tasks', requireAuth, (req, res) => {
    const { date, tasks } = req.body;
    const targetDate = date || new Date().toISOString().split('T')[0];

    if (!Array.isArray(tasks)) {
      return res.status(400).json({ error: 'tasks must be an array' });
    }

    const allTasks = dailyTasksStore.read();

    // Remove old tasks for the same date
    const filteredTasks = allTasks.filter(t => t.date !== targetDate);

    // Add new tasks with proper structure
    const newTasks = tasks.map((task, index) => ({
      id: task.id || `${targetDate}-${Date.now()}-${index}`,
      date: targetDate,
      title: task.title || '',
      description: task.description || '',
      completed: task.completed || false,
      priority: task.priority || 'medium',
      createdAt: task.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    dailyTasksStore.write([...filteredTasks, ...newTasks]);
    res.status(201).json(newTasks);
  });

  // Update a specific daily task
  router.patch('/daily-tasks/:id', requireAuth, (req, res) => {
    const task = dailyTasksStore.update(req.params.id, req.body);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  });

  // Delete a daily task
  router.delete('/daily-tasks/:id', requireAuth, (req, res) => {
    const removed = dailyTasksStore.remove(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Task not found' });
    res.json({ success: true });
  });

  // Clear all daily tasks for a specific date (or today if not specified)
  router.delete('/daily-tasks', requireAuth, (req, res) => {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const allTasks = dailyTasksStore.read();
    const remainingTasks = allTasks.filter(t => t.date !== date);
    const removedCount = allTasks.length - remainingTasks.length;
    
    dailyTasksStore.write(remainingTasks);
    res.json({ success: true, removedCount, date });
  });

  // Helper to get ISO week string (YYYY-W##)
  const getISOWeek = (date = new Date()) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  };

  // Get weekly tasks
  router.get('/weekly-tasks', (req, res) => {
    const week = req.query.week || getISOWeek();
    const tasks = weeklyTasksStore.read();
    const weekTasks = tasks.filter(t => t.week === week);
    res.json(weekTasks);
  });

  // Create/update weekly tasks
  router.post('/weekly-tasks', requireAuth, (req, res) => {
    const { week, tasks } = req.body;
    const targetWeek = week || getISOWeek();

    if (!Array.isArray(tasks)) {
      return res.status(400).json({ error: 'tasks must be an array' });
    }

    const allTasks = weeklyTasksStore.read();
    const filteredTasks = allTasks.filter(t => t.week !== targetWeek);

    const newTasks = tasks.map((task, index) => ({
      id: task.id || `${targetWeek}-${Date.now()}-${index}`,
      week: targetWeek,
      title: task.title || '',
      description: task.description || '',
      completed: task.completed || false,
      priority: task.priority || 'medium',
      createdAt: task.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    weeklyTasksStore.write([...filteredTasks, ...newTasks]);
    res.status(201).json(newTasks);
  });

  // Update a specific weekly task
  router.patch('/weekly-tasks/:id', requireAuth, (req, res) => {
    const task = weeklyTasksStore.update(req.params.id, req.body);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  });

  // Delete a weekly task
  router.delete('/weekly-tasks/:id', requireAuth, (req, res) => {
    const removed = weeklyTasksStore.remove(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Task not found' });
    res.json({ success: true });
  });

  // Helper to get month string (YYYY-MM)
  const getMonth = (date = new Date()) => {
    return new Date(date).toISOString().slice(0, 7);
  };

  // Get monthly tasks
  router.get('/monthly-tasks', (req, res) => {
    const month = req.query.month || getMonth();
    const tasks = monthlyTasksStore.read();
    const monthTasks = tasks.filter(t => t.month === month);
    res.json(monthTasks);
  });

  // Create/update monthly tasks
  router.post('/monthly-tasks', requireAuth, (req, res) => {
    const { month, tasks } = req.body;
    const targetMonth = month || getMonth();

    if (!Array.isArray(tasks)) {
      return res.status(400).json({ error: 'tasks must be an array' });
    }

    const allTasks = monthlyTasksStore.read();
    const filteredTasks = allTasks.filter(t => t.month !== targetMonth);

    const newTasks = tasks.map((task, index) => ({
      id: task.id || `${targetMonth}-${Date.now()}-${index}`,
      month: targetMonth,
      title: task.title || '',
      description: task.description || '',
      completed: task.completed || false,
      priority: task.priority || 'medium',
      createdAt: task.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    monthlyTasksStore.write([...filteredTasks, ...newTasks]);
    res.status(201).json(newTasks);
  });

  // Update a specific monthly task
  router.patch('/monthly-tasks/:id', requireAuth, (req, res) => {
    const task = monthlyTasksStore.update(req.params.id, req.body);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  });

  // Delete a monthly task
  router.delete('/monthly-tasks/:id', requireAuth, (req, res) => {
    const removed = monthlyTasksStore.remove(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Task not found' });
    res.json({ success: true });
  });

  return router;
};
