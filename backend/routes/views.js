const express = require('express');

module.exports = function (taskService, agentService, actionItemService) {
  const router = express.Router();

  // Helper to get top priority items
  const getTopPriorityItems = (items, limit = 15) => {
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    return items
      .filter(item => !item.completed)
      .sort((a, b) => {
        const priorityDiff = (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(b.createdAt) - new Date(a.createdAt);
      })
      .slice(0, limit);
  };

  router.get('/daily', (req, res) => {
    const agents = agentService.getAll();
    const today = new Date().toISOString().split('T')[0];
    
    // Get all action items, prioritize high-priority ones
    const allActionItems = actionItemService.getAll();
    const highPriorityItems = allActionItems.filter(item => 
      item.priority === 'high' || item.priority === 'critical'
    );
    
    const personal = getTopPriorityItems(highPriorityItems.filter(i => i.category === 'personal'), 10);
    const work = getTopPriorityItems(highPriorityItems.filter(i => i.category === 'work'), 10);
    
    // Get daily tasks for today
    const FileStore = require('../storage/FileStore');
    const dailyTasksStore = new FileStore('daily-tasks.json');
    const tasks = dailyTasksStore.read().filter(t => t.date === today);

    // Calculate stats by status
    const byStatus = {
      active: tasks.filter(t => !t.completed).length,
      done: tasks.filter(t => t.completed).length,
    };
    
    res.json({
      date: today,
      items: [...personal, ...work],
      personal,
      work,
      tasks, // Added daily tasks
      agents,
      stats: {
        total: highPriorityItems.length,
        personal: highPriorityItems.filter(i => i.category === 'personal').length,
        work: highPriorityItems.filter(i => i.category === 'work').length,
        tasks: tasks.length,
        completedTasks: tasks.filter(t => t.completed).length,
        byStatus, // Added for frontend compatibility
      }
    });
  });

  router.get('/weekly', (req, res) => {
    const agents = agentService.getAll();
    const now = new Date();
    const weekNum = getWeekNumber(now);
    const weekId = `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
    
    // Get all action items (weekly context)
    const allActionItems = actionItemService.getAll();
    
    const personal = getTopPriorityItems(allActionItems.filter(i => i.category === 'personal'), 15);
    const work = getTopPriorityItems(allActionItems.filter(i => i.category === 'work'), 15);
    
    res.json({
      week: weekId,
      startDate: getMonday(now).toISOString().split('T')[0],
      endDate: getSunday(now).toISOString().split('T')[0],
      items: [...personal, ...work],
      personal,
      work,
      agents,
      stats: {
        total: allActionItems.length,
        personal: allActionItems.filter(i => i.category === 'personal').length,
        work: allActionItems.filter(i => i.category === 'work').length,
      }
    });
  });

  router.get('/monthly', (req, res) => {
    const agents = agentService.getAll();
    const now = new Date();
    const monthKey = now.toISOString().slice(0, 7);
    
    // Get all action items (monthly strategic view)
    const allActionItems = actionItemService.getAll();
    
    const personal = getTopPriorityItems(allActionItems.filter(i => i.category === 'personal'), 20);
    const work = getTopPriorityItems(allActionItems.filter(i => i.category === 'work'), 20);
    
    res.json({
      month: now.toLocaleString('default', { month: 'long', year: 'numeric' }),
      monthKey,
      items: [...personal, ...work],
      personal,
      work,
      agents,
      stats: {
        total: allActionItems.length,
        personal: allActionItems.filter(i => i.category === 'personal').length,
        work: allActionItems.filter(i => i.category === 'work').length,
      }
    });
  });

  return router;
};

// Helper functions
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function getSunday(date) {
  const monday = getMonday(date);
  return new Date(monday.getTime() + 6 * 86400000);
}
